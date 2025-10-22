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
loadCrew("sprite", "toolbox-o");

// Layers
setLayers([
    "bg",
    "obj",
    "fg",
    "ui",
], "obj");

// Remove the default cursor and change the background
setCursor("none");
setBackground("1a1a1a");

//-------------
// Tiling
//-------------

loadSprite("map", "./test.png");
loadSprite("mapFg", "./testFg.png");

async function tiles() {
  // Load map data
  const mapData = await (await fetch("./test.json")).json();
  const map = add([pos(center()),scale(4),layer("bg")]);

  map.add([sprite("map")]);

  const mapFg = add([pos(center()),scale(4),layer("fg")]);
  mapFg.add([sprite("mapFg")]);

  // Object Layers
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

  // Edge Colliders
  const tileW = mapData.tilewidth || 32;
  const tileH = mapData.tileheight || 32;
  const mapW = (mapData.width || 0) * tileW;
  const mapH = (mapData.height || 0) * tileH;
  const thickness = Math.max(tileW, tileH, 16); // collider thickness in pixels

  // top
  map.add([
    pos(0, -thickness),
    area({ shape: new Rect(vec2(0), mapW, thickness) }),
    body({ isStatic: true }),
  ]);

  // bottom
  map.add([
    pos(0, mapH),
    area({ shape: new Rect(vec2(0), mapW, thickness) }),
    body({ isStatic: true }),
  ]);

  // left
  map.add([
    pos(-thickness, 0),
    area({ shape: new Rect(vec2(0), thickness, mapH) }),
    body({ isStatic: true }),
  ]);

  // right
  map.add([
    pos(mapW, 0),
    area({ shape: new Rect(vec2(0), thickness, mapH) }),
    body({ isStatic: true }),
  ]);
}

tiles();

//-------------
// Other Objects
//-------------

// Alan Becker himself (Alan Becker reference??)
const cursor = add([
    sprite("cursor"),
    pos(mousePos()),
    layer("ui"),
    scale(1),
]);

// The animator's toolkit (Alan Becker reference 2??)
const toolbox = add([
    sprite("toolbox-o"),
    pos(20,20),
    layer("ui"),
    scale(1),
    area(),
    body({ isStatic: true })
])

//-------------
// the chosen bean. (Alan Becker reference 3??)
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

// Define player movement variables
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

toolbox.onUpdate(() => {
    toolbox.pos = getCamPos().sub(center()).add(vec2(20,20));
})

toolbox.onHover(
    () => {
         toolbox.scale += (1.5 - toolbox.scale) / 3
    }, 
    () => {
         toolbox.scale += (1 - toolbox.scale) / 3
    }
)