// main.js
// Main javascript workflow for Cropbots (optimized tiling & draw)

//-------------
// Imports
//-------------
import kaplay from "https://unpkg.com/kaplay@3001.0.19/dist/kaplay.mjs";
import { crew } from 'https://cdn.skypack.dev/@kaplayjs/crew';

//-------------
// Constants
//-------------

// cropbot version
const VERSION = "v0.0.2-hotfix";
console.log("Cropbots version:", VERSION);

//-------------
// VM Worker
//-------------
const worker = new Worker("workers/vm-worker.js");
worker.onmessage = (e) => {
  const { type, data } = e.data;
  if (type === "log") console.log("Worker log:", ...data);
  else if (type === "result") console.log("Worker result:", data);
  else if (type === "error") console.error("Worker error:", data);
};
function vm_run(code) {
  worker.postMessage({ code });
}

//-------------
// Kaplay init
//-------------
kaplay({
  plugins: [crew],
  font: "happy-o",
  debugKey: "r",
  scale: 1,
});

setLayers(["bg","obj","fg","ui","cur"], "obj");
setCursor("none");
setBackground("1a1a1a");

//-------------
// Sprites & tiles
//-------------
loadBean();
loadCrew("font","happy-o");
loadCrew("sprite", "cursor");
loadCrew("sprite", "knock");
loadCrew("sprite", "glady");
loadCrew("sprite", "toolbox-o");
loadCrew("sprite", "menu-o");

loadSprite("map", "./test.png");
loadSprite("mapFg", "./testFg.png");
loadSpriteAtlas("assets/tileset.png", "assets/tileset.json");
loadSprite("chunk-24", "assets/chunk-24.png")

//-------------
// Map / tiling (optimized, chunked)
//-------------
requirejs(["modules/map"], function(map) {});

//-------------
// Objects & UI
//-------------
requirejs(["modules/objects"], function(objects) {});

// -----------------------------
// AI + Pathfinding (tile-based)
// -----------------------------
requirejs(["modules/ai"], function(ai) {});

//-------------
// Input & updates
//-------------
requirejs(["modules/updates"], function(updates) {});

//-------------
// Draw loop (chunk-aware, only draw visible chunks)
//-------------
requirejs(["modules/draw"], function(draw) {});