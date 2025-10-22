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
    debugKey: "r",
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
    "cur",
], "obj");

// Remove the default cursor and change the background
setCursor("none");
setBackground("1a1a1a");

//-------------
// Tiling
//-------------

loadSprite("map", "./test.png");
loadSprite("mapFg", "./testFg.png");
for (let i = 0; i < 223; i++) {
  loadSprite(`tile-${i}`, `./assets/tiles/${i}.png`);
}

const mapWidth = 32;
const mapHeight = 32;
const tileSize = 64;
const thickness = Math.max(tileSize, 16); // collider thickness in pixels
const map = add([pos(center()), scale(1), layer("bg")]);
let mapFg = [];
let mapBg = [];

function tiles() {
  // Background layer
  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
      const tileIndex = 24;
      mapBg.push([`tile-${tileIndex}`, vec2(x * tileSize, y * tileSize)]);
    }
  }

  // Foreground layer
  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
      const tileIndex = (Math.random() < 0.05) ? 56 + Math.round(Math.random()) : 0;
      mapFg.push([`tile-${tileIndex}`, vec2(x * tileSize, y * tileSize)]);

      if (tileIndex === 56 || tileIndex === 57) {
        map.add([
          area({ shape: new Rect(vec2(0), tileSize, tileSize) }),
          body({ isStatic: true }),
          pos(x * tileSize, y * tileSize),
        ]);
      }
    }
  }

  // top
  map.add([
    pos(0, -thickness),
    area({ shape: new Rect(vec2(0), mapWidth * tileSize, thickness) }),
    body({ isStatic: true }),
  ]);

  // bottom
  map.add([
    pos(0, mapHeight * tileSize),
    area({ shape: new Rect(vec2(0), mapWidth * tileSize, thickness) }),
    body({ isStatic: true }),
  ]);

  // left
  map.add([
    pos(-thickness, 0),
    area({ shape: new Rect(vec2(0), thickness, mapHeight * tileSize) }),
    body({ isStatic: true }),
  ]);

  // right
  map.add([
    pos(mapWidth * tileSize, 0),
    area({ shape: new Rect(vec2(0), thickness, mapHeight * tileSize) }),
    body({ isStatic: true }),
  ]);

  // Overlay layer
  // ...
}

tiles();

/*
async function tiles() {
  // Load map data
  const mapData = await (await fetch("./test.json")).json();
  const map = add([pos(center()),scale(4),layer("bg")]);

  map.add([sprite("map")]);

  const mapFg = add([pos(center()),scale(4),layer("fg")]);
  mapFg.add([sprite("mapFg")]);

  // Object layers
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

  // Edge colliders
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
*/

//-------------
// Other Objects
//-------------

// Alan Becker himself (Alan Becker reference??)
const cursor = add([
    sprite("cursor"),
    pos(mousePos()),
    layer("cur"),
    scale(1),
]);

// The hotbar items
loadSprite("hotbar-slot", "./assets/ui/hotbar-slot.png");
const hotbarItems = [];

for (let i = 0; i < 5; i++) {
  hotbarItems.push(add([
    sprite("hotbar-slot"),
    pos(50, 50),
    layer("ui"),
    scale(3.33),
    area(),
    anchor("center"),
    opacity(0.7),
  ]));
}

// The animator's toolkit (Alan Becker reference 2??)
const toolbox = add([
    sprite("toolbox-o"),
    pos(50,45),
    layer("ui"),
    scale(1),
    area(),
    anchor("center")
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

// Inventory setup
let hotbar = new Array(5).fill(0);
let inventoryToggle = false;
let toolboxScale = false;
let selectedItem = null;

//--------------
// Game loops (called every frame)
//--------------

// Player
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

// Cursor
cursor.onUpdate(() => {
    cursor.pos = getCamPos().sub(center()).add(mousePos());
})

// Inventory
toolbox.onHover(() => {toolboxScale = true});
toolbox.onHoverEnd(() => {toolboxScale = false});

toolbox.onMouseDown(() => { inventoryToggle = (inventoryToggle) ? false : true });

toolbox.onUpdate(() => {
    toolbox.pos = getCamPos().sub(center()).add(vec2(50,45));
    toolbox.scale = toolboxScale ? vec2(1.1,1.1) : vec2(1,1);
})

// Hotbar items
for (let i = 0; i < hotbarItems.length; i++) {
  hotbarItems[i].onHover(() => {hotbarItems[i].scale = vec2(3.5,3.5)});
  hotbarItems[i].onHoverEnd(() => {hotbarItems[i].scale = vec2(3.33,3.33)});
  hotbarItems[i].onUpdate(() => {
      hotbarItems[i].pos = getCamPos().sub(center()).add(vec2(125 + (i * 75), 50));
  });
}

// Draw loop
map.onDraw(() => {
    // Draw tiles
    for (let i = 0; i < mapBg.length; i++) {
      // Background layer
      drawSprite({
        sprite: mapBg[i][0],
        pos: mapBg[i][1],
        scale: 4,
      });
    }

    for (let i = 0; i < mapFg.length; i++) {
      // Foreground layer
      drawSprite({
        sprite: mapFg[i][0],
        pos: mapFg[i][1],
        scale: 4,
      });
    }

    // Overlay layer
    // ...
});

