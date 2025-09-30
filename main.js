// main.js
// Main javascript workflow for Cropbots

//-------------
// Imports
//-------------

import kaplay from "https://unpkg.com/kaplay@3001.0.19/dist/kaplay.mjs";

// VM Worker

const worker = new Worker("workers/vm-worker.js");

// Handle worker messages
worker.onmessage = (e) => {
    const { type, data } = e.data;
    if (type === "log") {
      console.log("Worker log:", ...data);
    } else if (type === "result") {
      console.log("Worker result:", data);
    } else if (type === "error") {
      console.error("Worker error:", data);
    }
};

  // Send code to run
function vm_run(e) {
    worker.postMessage({
        code: e
    });
}

const pageWidth = document.documentElement.scrollWidth;
const pageHeight = document.documentElement.scrollHeight;

kaplay(/*{
  width: pageWidth,
  height: pageHeight
*/);