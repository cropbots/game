// main.js
// Main javascript workflow for Cropbots

//-------------
// Imports
//-------------


// Import Kaplay Game Engine from CDN
import kaplay from "https://unpkg.com/kaplay@3001.0.19/dist/kaplay.mjs";

// Import Kaplay Crew from CDN
import { crew } from 'https://cdn.skypack.dev/@kaplayjs/crew';

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

// Kaplay initialization w/ the bean n friends.
kaplay({
    plugins: [crew],
    font: "happy-o",
});

loadBean();
loadCrew("font","happy-o");
loadCrew("sprite", "cursor");
loadCrew("sprite", "knock");
loadCrew("sprite", "glady");

// Layers
layers([
    "bg",
    "obj",
    "fg",
    "ui",
], "obj");

// Remove the default cursor
setCursor("none");

//-------------
// Tiling
//-------------

loadSprite("map", "./test.png");
loadSprite("mapFg", "./testFg.png");

async function tiles() {
  const mapData = await (await fetch("./test.json")).json();
  const map = add([pos(center()),scale(4),layer("bg")]);

  map.add([sprite("map")]);

  const mapFg = add([pos(center()),scale(4),layer("fg")]);
  mapFg.add([sprite("mapFg")]);

  for (const layer of mapData.layers) {
    if (layer.type === "background" || layer.type === "foreground" || layer.type === "overlay") continue;

    if (layer.name === "colliders") {
      for (const object of layer.objects) {
        map.add([
          area({ shape: new Rect(vec2(0), object.width, object.height)   }),
          body({ isStatic: true }),
          pos(object.x, object.y),
        ]);
      }
      continue;
    }
  }
}

tiles();

//-------------
// Other Objects
//-------------

// Alan Becker himself
const cursor = add([
    sprite("cursor"),
    pos(mousePos()),
    layer("ui"),
    scale(1.5),
]);

// THE SECOND BEANING (Alan Becker reference??)
const beanObstacle = add([
    sprite("bean"),
    pos(320, 120),
    color(255, 202, 79),
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
    pos(center()),
    color(),
    rotate(0),
    area(),
    body(),
]);

// Define player movement speed
const player_speed = 100;
const friction = 0.7;
let xVel = 0;
let yVel = 0;


//--------------
// Game loops (called every frame)
//--------------

player.onUpdate(() => {
    // Player Movement
    const inputX = (isKeyDown("d") ? 1 : 0) - (isKeyDown("a") ? 1 : 0);
    const inputY = (isKeyDown("s") ? 1 : 0) - (isKeyDown("w") ? 1 : 0);
    
    xVel += inputX * player_speed;
    yVel += inputY * player_speed;

    const targetVel = vec2(xVel, yVel);
    xVel *= friction;
    yVel *= friction;

    player.vel = targetVel;
    // Camera follow
    setCamPos(getCamPos().lerp(player.pos, 0.12));
})

cursor.onUpdate(() => {
    cursor.pos = getCamPos().sub(center()).add(mousePos());
})