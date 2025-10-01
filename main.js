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
// Other Objects
//-------------


// THE SECOND BEANING (Alan Becker reference??)
const beanObstacle = add([
    sprite("bean"),
    pos(-320, 0)
    color("wheat"),
    rotate(0),
    area(),
    body({ mass: 10 }),
])

//-------------
// the chosen bean. (Alan Becker reference 2??)
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
let player_xVel = 0;
let player_yVel = 0;
const friction = 0.7;
const player_speed = 150;

// bean movement.
onKeyDown("a", () => {
    player_xVel -= player_speed
});

onKeyDown("d", () => {
    player_xVel += player_speed
});

onKeyDown("w", () => {
    player_yVel -= player_speed
});

onKeyDown("s", () => {
    player_yVel += player_speed
});

//--------------
// Player loop (called every frame)
//--------------

player.onUpdate(() => {
    // Player Movement
    player.move(player_xVel, player_yVel);
    player_xVel *= friction;
    player_yVel *= friction;
    camPos(player.pos);
})