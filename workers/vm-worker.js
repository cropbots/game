// vm-worker.js
// Production-hardened Web Worker for running user code in a limited sandbox.
//
// Protocol (messages from main -> worker):
//   { type: "run", id: "<unique id>", code: "<string>", env: { optional safe api } }
//   { type: "terminate" }  // optional, instructs worker to stop (main may still call worker.terminate())
//
// Messages from worker -> main:
//   { type: "ready" }
//   { type: "log", level: "log"|"warn"|"error"|"info", id, args: [...] }
//   { type: "started", id }
//   { type: "result", id, result }
//   { type: "error", id, message, stack }
//   { type: "done", id }
//
// IMPORTANT: The main thread should set a timer after sending a "run" and call worker.terminate()
// if no 'done' or 'error' is returned within the allowed time window.

(() => {
  'use strict';

  // -----------------------
  // 1) Harden globals (do this before anything else)
  // -----------------------
  try {
    // block network / dynamic script loading
    self.fetch = () => { throw new Error('fetch() disabled in sandbox'); };
    self.importScripts = () => { throw new Error('importScripts() disabled in sandbox'); };
    self.XMLHttpRequest = function () { throw new Error('XMLHttpRequest disabled in sandbox'); };

    // block worker creation / cross-context channels
    self.Worker = function () { throw new Error('Worker creation disabled in sandbox'); };
    self.SharedWorker = function () { throw new Error('SharedWorker disabled in sandbox'); };
    self.BroadcastChannel = function () { throw new Error('BroadcastChannel disabled in sandbox'); };

    // block sockets / streaming APIs
    self.WebSocket = function () { throw new Error('WebSocket disabled in sandbox'); };
    self.EventSource = function () { throw new Error('EventSource disabled in sandbox'); };

    // persistent storage / caches
    try { self.indexedDB = undefined; } catch (e) { /* ignore if not writable */ }
    try { self.caches = undefined; } catch (e) { /* ignore */ }
    try { self.localStorage = undefined; self.sessionStorage = undefined; } catch (e) {}

    // timers: disallow string-based timers while keeping function form
    const _setTimeout = self.setTimeout;
    const _setInterval = self.setInterval;
    self.setTimeout = (fn, ...args) => {
      if (typeof fn === 'string') throw new Error('setTimeout(string) disabled in sandbox');
      return _setTimeout(fn, ...args);
    };
    self.setInterval = (fn, ...args) => {
      if (typeof fn === 'string') throw new Error('setInterval(string) disabled in sandbox');
      return _setInterval(fn, ...args);
    };

    // other risky globals
    self.postMessage = self.postMessage.bind(self); // keep postMessage
    // Optionally block URL.createObjectURL (may not be necessary)
    if (typeof URL !== 'undefined' && URL.createObjectURL) {
      URL.createObjectURL = () => { throw new Error('createObjectURL disabled in sandbox'); };
    }
  } catch (e) {
    // If we can't apply some overrides (non-writable), continue — best effort.
  }

  // -----------------------
  // 2) Console forwarding (structured)
  // -----------------------
  const sendMessage = (msg) => {
    // keep messages serializable (avoid functions etc.)
    try { postMessage(msg); } catch (e) { /* swallow */ }
  };

  const makeConsoleForward = (level) => (...args) => {
    // try to serialize safely; main thread will display/sanitize
    const safeArgs = args.map(a => {
      try {
        // structured clone will handle many types; convert functions to string
        if (typeof a === 'function') return '[Function]';
        return a;
      } catch (e) { return String(a); }
    });
    sendMessage({ type: 'log', level, args: safeArgs });
  };

  const fakeConsole = {
    log: makeConsoleForward('log'),
    info: makeConsoleForward('info'),
    warn: makeConsoleForward('warn'),
    error: makeConsoleForward('error'),
  };

  // Also catch any unhandled errors within the worker (outside user code)
  self.addEventListener('error', (ev) => {
    sendMessage({ type: 'log', level: 'error', args: ['Worker uncaught error:', ev.message, ev.filename + ':' + ev.lineno] });
  });

  // -----------------------
  // 3) Utility: safe JSON stringify fallback
  // -----------------------
  const safeSerialize = (v) => {
    try { return JSON.parse(JSON.stringify(v)); } catch (e) {
      try { return String(v); } catch (e2) { return '[unserializable]'; }
    }
  };

  // -----------------------
  // 4) Code execution strategy
  // -----------------------
  // We'll compile a trusted runner function using local `Function` per-run,
  // then immediately lock down `Function` and `eval` to reduce attack surface.
  //
  // Runner signature: (console, sandboxEnv) => { /* executed user code */ }
  //
  // The runner is invoked synchronously. If user code does CPU-bound infinite loops,
  // main must terminate the worker.

  const compileRunner = (code) => {
    // We wrap the user's code in an IIFE so top-level `return` is not allowed.
    // Provide 'console' and 'env' variables. Use 'use strict'.
    // IMPORTANT: do not leave references to Function or eval in the environment.
    const wrapper =
      `"use strict";\n` +
      `const __userMain = (function(console, env) {\n` +
      `  try {\n` +
      `    ${code}\n` +
      `  } catch (__e) {\n` +
      `    throw __e;\n` +
      `  }\n` +
      `});\n` +
      `return __userMain;`;

    // Create the runner from the wrapper string.
    // This is the only place we use Function to compile user code.
    const Runner = new Function(wrapper); // eslint-disable-line no-new-func
    return Runner(); // returns the __userMain function
  };

  // Immediately notify main that worker is ready
  sendMessage({ type: 'ready' });

  // -----------------------
  // 5) Message handling: run/terminate/control
  // -----------------------
  self.onmessage = function (ev) {
    const msg = ev.data;
    if (!msg || !msg.type) return;

    if (msg.type === 'run') {
      const id = msg.id || null;
      const code = typeof msg.code === 'string' ? msg.code : '';
      const userEnv = (msg.env && typeof msg.env === 'object') ? msg.env : {};

      // Notify start
      sendMessage({ type: 'started', id });

      // Compile runner (trusted creation point)
      let runner;
      try {
        runner = compileRunner(code);
      } catch (compileErr) {
        sendMessage({ type: 'error', id, message: String(compileErr.message || compileErr), stack: compileErr.stack || null });
        sendMessage({ type: 'done', id });
        return;
      }

      // Lock down dynamic eval/Function now we have compiled the runner.
      // This reduces the surface for the running user code.
      try {
        self.Function = () => { throw new Error('Function constructor disabled in sandbox'); };
        self.eval = () => { throw new Error('eval disabled in sandbox'); };
      } catch (e) {
        // ignore if not writable
      }

      // Build a minimal safe environment object for the user's code
      // Copy only simple serializable safe entries from userEnv (and any allowed APIs)
      const sandboxEnv = {};
      // Allow user to access provided safe APIs (if any) but do not pass functions directly unless intentionally allowed
      // If you need to expose callable APIs, pass them in explicitly from main and trust them.
      for (const k of Object.keys(userEnv)) {
        const v = userEnv[k];
        // Allow simple primitives, arrays, plain objects. Avoid passing global/window refs
        if (v === null) sandboxEnv[k] = null;
        else if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') sandboxEnv[k] = v;
        else if (Array.isArray(v)) sandboxEnv[k] = safeSerialize(v);
        else if (typeof v === 'object') sandboxEnv[k] = safeSerialize(v);
        // ignore functions or other exotic types unless you explicitly want to allow them
      }

      // Attach console we control to the env as well
      sandboxEnv.console = fakeConsole;

      // Now execute the runner. This is synchronous.
      try {
        // Call user code. It can return a value or not.
        // We wrap in Promise.resolve in case user used async constructs that return Promises.
        const maybePromise = runner(fakeConsole, sandboxEnv);

        // If the result is a Promise, handle it asynchronously (still subject to main-side timeout)
        if (maybePromise && typeof maybePromise.then === 'function') {
          // handle async result
          maybePromise.then(
            (res) => {
              sendMessage({ type: 'result', id, result: safeSerialize(res) });
              sendMessage({ type: 'done', id });
            },
            (err) => {
              sendMessage({ type: 'error', id, message: String(err && err.message ? err.message : err), stack: err && err.stack ? err.stack : null });
              sendMessage({ type: 'done', id });
            }
          );
        } else {
          // sync result
          sendMessage({ type: 'result', id, result: safeSerialize(maybePromise) });
          sendMessage({ type: 'done', id });
        }
      } catch (runErr) {
        // runtime error
        sendMessage({ type: 'error', id, message: String(runErr && runErr.message ? runErr.message : runErr), stack: runErr && runErr.stack ? runErr.stack : null });
        sendMessage({ type: 'done', id });
      }

      return;
    }

    if (msg.type === 'terminate') {
      // main asked the worker to stop gracefully
      try { close(); } catch (e) { /* best effort */ }
      return;
    }

    // Unknown message types are ignored
  };

})();
