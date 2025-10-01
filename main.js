// main.js
// Main javascript workflow for Cropbots

//-------------
// Imports
//-------------


// Import Kaplay Game Engine from CDN
import kaplay from "https://unpkg.com/kaplay@3001.0.19/dist/kaplay.mjs";

//-------------
// Constants
//-------------

const VERSION = "0.0.1";
console.log("Cropbots version:", VERSION);

//-------------
// VM Worker
//-------------

// Create a new web worker using the vm-worker.js script
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

//-------------
// Page Dimensions
//-------------

// Get the page dimensions
const pageWidth = document.documentElement.scrollWidth;
const pageHeight = document.documentElement.scrollHeight;

//-------------
// Kaplay
//-------------

// Kaplay initialization w/ the bean.
kaplay();
loadBean();

//-------------
// the bean.
//-------------

// Create your vessel. (Deltarune reference??)
const player = add([
    sprite("bean"),
    pos(80, 40),
    color(),
    rotate(0),
    area(),
    body(),
]);

// Define player movement speed
let player.xVel = 0;
let player.yVel = 0;
let friction = 0.7;
const player.speed = 150;

// bean movement.
onKeyDown("a", () => {
    player.xVel -= player.speed
});

onKeyDown("d", () => {
    player.xVel += player.speed
});

onKeyDown("w", () => {
    player.yVel -= player.speed
});

onKeyDown("s", () => {
    player.xVel += player.speed
});

//--------------
// Main game loop (called every frame)
//--------------

onUpdate(() => {
    // Player Movement
    player.move(player.xVel, player.yVel);
    xVel *= friction;
    yVel *= friction;
})