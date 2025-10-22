// main.js
// Main javascript workflow for Cropbots (optimized tiling & draw)

//-------------
// Imports
//-------------

// Kaplay engine
import kaplay from "https://unpkg.com/kaplay@3001.0.19/dist/kaplay.mjs";
import { crew } from 'https://cdn.skypack.dev/@kaplayjs/crew';

//-------------
// Constants
//-------------
const VERSION = "0.0.2";
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
});

loadBean();
loadCrew("font","happy-o");
loadCrew("sprite", "cursor");
loadCrew("sprite", "knock");
loadCrew("sprite", "glady");
loadCrew("sprite", "toolbox-o");

setLayers(["bg","obj","fg","ui","cur"], "obj");
setCursor("none");
setBackground("1a1a1a");

//-------------
// Sprites & tiles
//-------------
loadSprite("map", "./test.png");
loadSprite("mapFg", "./testFg.png");
for (let i = 0; i < 223; i++) {
  loadSprite(`tile-${i}`, `./assets/tiles/${i}.png`);
}

//-------------
// Map / tiling (optimized, chunked)
//-------------
const mapPixelWidth = 128 * 64;   // map width in pixels
const mapPixelHeight = 128 * 64;  // map height in pixels
const tileSize = 64;
const thickness = Math.max(tileSize, 16);

// number of cols/rows (tiles)
const cols = Math.ceil(mapPixelWidth / tileSize);
const rows = Math.ceil(mapPixelHeight / tileSize);
const tileCount = cols * rows;

// chunking config
const CHUNK_TILES = 16; // 16x16 tiles per chunk
const CHUNK_PX = CHUNK_TILES * tileSize;
const chunkCols = Math.ceil(cols / CHUNK_TILES);
const chunkRows = Math.ceil(rows / CHUNK_TILES);
const chunkCount = chunkCols * chunkRows;

// map entities / layers
// Use world origin for the map so tile coords (0..mapPixelWidth) match camera/world coordinates.
const map = add([pos(0, 0), scale(1), layer("bg")]);
const mapOverlay = add([pos(0, 0), scale(1), layer("fg")]);

// store tile indices (much smaller & faster than objects)
const mapBgIdx = new Uint16Array(tileCount); // background tile index per cell
const mapFgIdx = new Uint16Array(tileCount); // foreground tile index per cell
const colliderMask = new Uint8Array(tileCount); // 1 if this cell needs a collider

// chunk metadata
const chunks = new Array(chunkCount);
for (let i = 0; i < chunkCount; i++) {
  chunks[i] = {
    visible: false,
    bodies: [],     // entities created for this chunk (colliders)
    lastSeen: 0,    // frame counter (optional)
  };
}

let frameCounter = 0;

function tileIndexAt(x, y) {
  return y * cols + x;
}

function chunkIndexAt(cx, cy) {
  return cy * chunkCols + cx;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function createTiles() {
  // fill background & foreground arrays and mark colliders
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = tileIndexAt(x, y);
      mapBgIdx[idx] = 24;
      const fgIndex = (Math.random() < 0.05) ? 56 + Math.round(Math.random()) : 0;
      mapFgIdx[idx] = fgIndex;
      if (fgIndex === 56 || fgIndex === 57) colliderMask[idx] = 1;
    }
  }

  // map boundaries - keep permanent bodies for world edges
  map.add([
    pos(0, -thickness),
    area({ shape: new Rect(vec2(0), mapPixelWidth, thickness) }),
    body({ isStatic: true }),
  ]);
  map.add([
    pos(0, mapPixelHeight),
    area({ shape: new Rect(vec2(0), mapPixelWidth, thickness) }),
    body({ isStatic: true }),
  ]);
  map.add([
    pos(-thickness, 0),
    area({ shape: new Rect(vec2(0), thickness, mapPixelHeight) }),
    body({ isStatic: true }),
  ]);
  map.add([
    pos(mapPixelWidth, 0),
    area({ shape: new Rect(vec2(0), thickness, mapPixelHeight) }),
    body({ isStatic: true }),
  ]);
}

createTiles();

//-------------
// Chunk collider management
//-------------
// create colliders for a specific chunk (merge horizontal spans inside chunk)
function createChunkColliders(cx, cy) {
  const chunk = chunks[chunkIndexAt(cx, cy)];
  if (!chunk || chunk.visible) return;
  const startX = cx * CHUNK_TILES;
  const startY = cy * CHUNK_TILES;
  const endX = Math.min(startX + CHUNK_TILES, cols);
  const endY = Math.min(startY + CHUNK_TILES, rows);

  for (let y = startY; y < endY; y++) {
    let x = startX;
    while (x < endX) {
      const idx = tileIndexAt(x, y);
      if (colliderMask[idx]) {
        // horizontal merge within chunk bounds
        let sx = x, ex = x + 1;
        while (ex < endX && colliderMask[tileIndexAt(ex, y)]) ex++;
        const rectX = sx * tileSize;
        const rectY = y * tileSize;
        const rectW = (ex - sx) * tileSize;
        const rectH = tileSize;
        const bodyEnt = map.add([
          pos(rectX, rectY),
          area({ shape: new Rect(vec2(0), rectW, rectH) }),
          body({ isStatic: true }),
        ]);
        chunk.bodies.push(bodyEnt);
        x = ex;
      } else {
        x++;
      }
    }
  }

  chunk.visible = true;
  chunk.lastSeen = frameCounter;
}

// remove colliders for a specific chunk
function removeChunkColliders(cx, cy) {
  const chunk = chunks[chunkIndexAt(cx, cy)];
  if (!chunk || !chunk.visible) return;
  for (let b of chunk.bodies) {
    try { destroy(b); } catch (e) { /* ignore if destroy not available */ }
  }
  chunk.bodies.length = 0;
  chunk.visible = false;
}

//-------------
// Visibility & drawing helpers (chunk-aware)
//-------------
function updateVisibleChunks(minTileX, maxTileX, minTileY, maxTileY) {
  frameCounter++;

  const minChunkX = clamp(Math.floor(minTileX / CHUNK_TILES), 0, chunkCols - 1);
  const maxChunkX = clamp(Math.floor(maxTileX / CHUNK_TILES), 0, chunkCols - 1);
  const minChunkY = clamp(Math.floor(minTileY / CHUNK_TILES), 0, chunkRows - 1);
  const maxChunkY = clamp(Math.floor(maxTileY / CHUNK_TILES), 0, chunkRows - 1);

  // create colliders for visible chunks, remove for chunks that went out of view
  for (let cy = 0; cy < chunkRows; cy++) {
    for (let cx = 0; cx < chunkCols; cx++) {
      const inView = (cx >= minChunkX && cx <= maxChunkX && cy >= minChunkY && cy <= maxChunkY);
      if (inView) {
        createChunkColliders(cx, cy);
      } else {
        // optional: only remove if it was created earlier (keeps memory lower)
        if (chunks[chunkIndexAt(cx, cy)].visible) removeChunkColliders(cx, cy);
      }
    }
  }

  return { minChunkX, maxChunkX, minChunkY, maxChunkY };
}

//-------------
// Other objects & UI
//-------------
const cursor = add([
  sprite("cursor"),
  pos(mousePos()),
  layer("cur"),
  scale(1),
]);

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

const toolbox = add([
  sprite("toolbox-o"),
  pos(50,45),
  layer("ui"),
  scale(1),
  area(),
  anchor("center")
]);

const player = add([
  sprite("bean"),
  // Start player in the center of the map (world coords)
  pos(vec2(mapPixelWidth / 2, mapPixelHeight / 2)),
  color(),
  rotate(0),
  area(),
  body(),
]);

// movement
const player_speed = 100;
const friction = 0.7;
let xVel = 0;
let yVel = 0;

// inventory
let hotbar = new Array(5).fill(0);
let inventoryToggle = false;
let toolboxScale = false;

//-------------
// Input & updates
//-------------
player.onUpdate(() => {
  const inputX = (isKeyDown("d") ? 1 : 0) - (isKeyDown("a") ? 1 : 0);
  const inputY = (isKeyDown("s") ? 1 : 0) - (isKeyDown("w") ? 1 : 0);
  xVel += inputX * player_speed;
  yVel += inputY * player_speed;
  const targetVel = vec2(xVel, yVel);
  xVel *= friction;
  yVel *= friction;
  player.vel = targetVel;
  setCamPos(getCamPos().lerp(player.pos, 0.12));
});

cursor.onUpdate(() => {
  cursor.pos = getCamPos().sub(center()).add(mousePos());
});

toolbox.onHover(() => { toolboxScale = true; });
toolbox.onHoverEnd(() => { toolboxScale = false; });
toolbox.onMouseDown(() => { inventoryToggle = !inventoryToggle; });
toolbox.onUpdate(() => {
  toolbox.pos = getCamPos().sub(center()).add(vec2(50,45));
  toolbox.scale = toolboxScale ? vec2(1.1,1.1) : vec2(1,1);
});

for (let i = 0; i < hotbarItems.length; i++) {
  hotbarItems[i].onHover(() => { hotbarItems[i].scale = vec2(3.5,3.5); });
  hotbarItems[i].onHoverEnd(() => { hotbarItems[i].scale = vec2(3.33,3.33); });
  hotbarItems[i].onUpdate(() => {
    hotbarItems[i].pos = getCamPos().sub(center()).add(vec2(125 + (i * 75), 50));
  });
}

//-------------
// Draw loop (chunk-aware, only draw visible chunks)
//-------------
map.onDraw(() => {
  // compute visible tile range once per frame
  const cam = getCamPos();
  const halfW = width() / 2;
  const halfH = height() / 2;
  const minTileX = clamp(Math.floor((cam.x - halfW) / tileSize), 0, cols - 1);
  const maxTileX = clamp(Math.floor((cam.x + halfW) / tileSize), 0, cols - 1);
  const minTileY = clamp(Math.floor((cam.y - halfH) / tileSize), 0, rows - 1);
  const maxTileY = clamp(Math.floor((cam.y + halfH) / tileSize), 0, rows - 1);

  // update visible chunks and create/remove colliders as needed
  const { minChunkX, maxChunkX, minChunkY, maxChunkY } =
    updateVisibleChunks(minTileX, maxTileX, minTileY, maxTileY);

  // draw tiles chunk-by-chunk (only visible chunks)
  for (let cy = minChunkY; cy <= maxChunkY; cy++) {
    const tileY0 = cy * CHUNK_TILES;
    const tileY1 = Math.min(tileY0 + CHUNK_TILES, rows);
    for (let cx = minChunkX; cx <= maxChunkX; cx++) {
      const tileX0 = cx * CHUNK_TILES;
      const tileX1 = Math.min(tileX0 + CHUNK_TILES, cols);
      // draw tiles inside this chunk
      for (let y = tileY0; y < tileY1; y++) {
        for (let x = tileX0; x < tileX1; x++) {
          const idx = tileIndexAt(x, y);
          const px = x * tileSize;
          const py = y * tileSize;
          const bgIdx = mapBgIdx[idx];
          if (bgIdx !== 0) drawSprite({ sprite: `tile-${bgIdx}`, pos: vec2(px, py), scale: 4 });
          const fgIdx = mapFgIdx[idx];
          if (fgIdx !== 0) drawSprite({ sprite: `tile-${fgIdx}`, pos: vec2(px, py), scale: 4 });
        }
      }
    }
  }
});

mapOverlay.onDraw(() => {
  // overlay drawing if needed
});