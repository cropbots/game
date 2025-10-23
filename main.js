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
const VERSION = "nightly20251023";
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

loadBean();
loadCrew("font","happy-o");
loadCrew("sprite", "cursor");
loadCrew("sprite", "knock");
loadCrew("sprite", "glady");
loadCrew("sprite", "toolbox-o");
loadCrew("sprite", "menu-o");

setLayers(["bg","obj","fg","ui","cur"], "obj");
setCursor("none");
setBackground("1a1a1a");

//-------------
// Sprites & tiles
//-------------
loadSprite("map", "./test.png");
loadSprite("mapFg", "./testFg.png");
loadSpriteAtlas("assets/tileset.png", "assets/tileset.json");
loadSprite("chunk-24", "assets/chunk-24.png")

/*
for (let i = 0; i < 223; i++) {
  loadSprite(`tile-${i}`, `./assets/tiles/${i}.png`);
}
*/

//-------------
// Map / tiling (optimized, chunked)
//-------------
const mapPixelWidth = 512 * 64;   // map width in pixels
const mapPixelHeight = 512 * 64;  // map height in pixels
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
const map = add([pos(0, 0), scale(1), layer("bg")]);
const mapOverlay = add([pos(0, 0), scale(1), layer("fg")]);

// store tile indices (much smaller & faster than objects)
const mapBgIdx = new Uint16Array(tileCount); // background tile index per cell
const mapFgIdx = new Uint16Array(tileCount); // foreground tile index per cell
const colliderMask = new Uint8Array(tileCount); // 1 if this cell needs a collider
const mapOverlayIdx = new Uint16Array(tileCount); // new array for overlay sprites

// chunk metadata
const chunks = Array.from({ length: chunkCount }, () => ({
  visible: false,
  bodies: [],
  lastSeen: 0,
}));

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

// Add these helper functions before createTiles()
function canPlaceBush(x, y) {
  if (x < 0 || x >= cols || y < 0 || y >= rows) return false;
  // Check surrounding 8 tiles for other bushes
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
        const idx = tileIndexAt(nx, ny);
        if (mapFgIdx[idx] === 56 || mapFgIdx[idx] === 57) return false;
      }
    }
  }
  return true;
}

function canPlaceTree(x, y) {
  // Check a 4x5 area (2 tiles padding around tree) for other trees
  for (let dy = -1; dy < 4; dy++) {
    for (let dx = -1; dx < 3; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
        const idx = tileIndexAt(nx, ny);
        if (mapFgIdx[idx] !== 0 || mapOverlayIdx[idx] !== 0) {
          return false;
        }
      }
    }
  }
  return true;
}

// Optimized createTiles function
function createTiles() {
  // Fill background with base tiles
  mapBgIdx.fill(24); // base tile

  // Place vegetation with spacing rules
  const randomValues = Array.from({ length: cols * rows }, () => Math.random());
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = tileIndexAt(x, y);
      const r = randomValues[idx]; // Use pre-generated random value

      if (r < 0.015 && canPlaceTree(x, y)) {
        // Place 2x3 tree structure
        const treeSprites = [157, 158, 174, 175, 191, 192];
        for (let ty = 0; ty < 3; ty++) {
          for (let tx = 0; tx < 2; tx++) {
            const treeIdx = tileIndexAt(x + tx, y + ty);
            const spriteIdx = treeSprites[ty * 2 + tx];
            if (ty < 2) {
              mapOverlayIdx[treeIdx] = spriteIdx; // Canopy in overlay
            } else {
              mapFgIdx[treeIdx] = spriteIdx; // Trunk in foreground
              colliderMask[treeIdx] = 1;
            }
          }
        }
      } else if (r < 0.07 && canPlaceBush(x, y) && mapFgIdx[idx] === 0 && mapOverlayIdx[idx] === 0) {
        mapFgIdx[idx] = 56 + Math.round(Math.random());
        colliderMask[idx] = 1;
      }
    }
  }

  // map boundaries - keep permanent bodies for world edges
  const boundaries = [
    { _pos: [0, -thickness], size: [mapPixelWidth, thickness] },
    { _pos: [0, mapPixelHeight], size: [mapPixelWidth, thickness] },
    { _pos: [-thickness, 0], size: [thickness, mapPixelHeight] },
    { _pos: [mapPixelWidth, 0], size: [thickness, mapPixelHeight] },
  ];

  boundaries.forEach(({ _pos, size }) => {
    map.add([
      pos(..._pos),
      area({ shape: new Rect(vec2(0), ...size) }),
      body({ isStatic: true }),
    ]);
  });
}

createTiles();

//-------------
// Chunk collider management
//-------------
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

function removeChunkColliders(cx, cy) {
  const chunk = chunks[chunkIndexAt(cx, cy)];
  if (!chunk || !chunk.visible) return;
  chunk.bodies.forEach(b => {
    try { destroy(b); } catch (e) { /* ignore if destroy not available */ }
  });
  chunk.bodies.length = 0;
  chunk.visible = false;
}

//-------------
// Visibility & drawing helpers (chunk-aware)
//-------------
let lastVisibleChunks = { minChunkX: 0, maxChunkX: 0, minChunkY: 0, maxChunkY: 0 };

function updateVisibleChunks(minTileX, maxTileX, minTileY, maxTileY) {
  frameCounter++;

  if (frameCounter % 3 === 0) {
    const minChunkX = clamp(Math.floor(minTileX / CHUNK_TILES), 0, chunkCols - 1);
    const maxChunkX = clamp(Math.floor(maxTileX / CHUNK_TILES), 0, chunkCols - 1);
    const minChunkY = clamp(Math.floor(minTileY / CHUNK_TILES), 0, chunkRows - 1);
    const maxChunkY = clamp(Math.floor(maxTileY / CHUNK_TILES), 0, chunkRows - 1);

    for (let cy = 0; cy < chunkRows; cy++) {
      for (let cx = 0; cx < chunkCols; cx++) {
        const inView = (cx >= minChunkX && cx <= maxChunkX && cy >= minChunkY && cy <= maxChunkY);
        if (inView) {
          createChunkColliders(cx, cy);
        } else {
          if (chunks[chunkIndexAt(cx, cy)].visible) removeChunkColliders(cx, cy);
        }
      }
    }

  lastVisibleChunks = { minChunkX, maxChunkX, minChunkY, maxChunkY };
  }

  return lastVisibleChunks;
}

//-------------
// Objects & UI
//-------------
const player = add([
  sprite("bean"),
  pos(vec2(mapPixelWidth / 2, mapPixelHeight / 2)),
  color(),
  rotate(0),
  area(),
  body(),
]);
setCamPos(player.pos);

const cursor = add([
  sprite("cursor"),
  pos(mousePos()),
  layer("cur"),
  scale(1),
]);

loadSprite("hotbar-slot", "./assets/ui/hotbar-slot.png");
const hotbarItems = Array.from({ length: 5 }, (_, i) => add([
  sprite("hotbar-slot"),
  pos(50, 50),
  layer("ui"),
  scale(3.33),
  area(),
  anchor("center"),
  opacity(0.7),
]));

const toolbox = add([
  sprite("toolbox-o"),
  pos(getCamPos().sub(center()).add(vec2(50, 45))),
  layer("ui"),
  scale(1),
  area(),
  anchor("center")
]);

const menu = add([
  sprite("menu-o"),
  pos(getCamPos().add(center()).sub(vec2(50, 45))),
  layer("ui"),
  scale(1),
  area(),
  anchor("center")
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

// menu
let menuToggle = false;
let menuScale = false;

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

  const cam = getCamPos();
  setCamPos(vec2(
    Math.floor(cam.x),
    Math.floor(cam.y)
  ));
});

cursor.onUpdate(() => {
  cursor.pos = getCamPos().sub(center()).add(mousePos());
});

toolbox.onHover(() => { toolboxScale = true; });
toolbox.onHoverEnd(() => { toolboxScale = false; });
toolbox.onMouseDown(() => { inventoryToggle = !inventoryToggle; });
toolbox.onUpdate(() => {
  toolbox.pos = getCamPos().sub(center()).add(vec2(50, 45));
  toolbox.scale = toolboxScale ? vec2(1.1, 1.1) : vec2(1, 1);
});

hotbarItems.forEach((item, i) => {
  item.onHover(() => { item.scale = vec2(3.5, 3.5); });
  item.onHoverEnd(() => { item.scale = vec2(3.33, 3.33); });
  item.onUpdate(() => {
    item.pos = getCamPos().sub(center()).add(vec2(125 + (i * 75), 50));
  });
});

menu.onHover(() => { menuScale = true; });
menu.onHoverEnd(() => { menuScale = false; });
menu.onMouseDown(() => { menuToggle = !menuToggle; });
menu.onUpdate(() => {
  menu.pos = getCamPos().add(center()).sub(vec2(50, 45));
  menu.scale = menuScale ? vec2(1.1, 1.1) : vec2(1, 1);
})

//-------------
// Draw loop (chunk-aware, only draw visible chunks)
//-------------
map.onDraw(() => {
  const cam = getCamPos();
  const halfW = width() / 2;
  const halfH = height() / 2;
  const minTileX = clamp(Math.floor((cam.x - halfW) / tileSize), 0, cols - 1);
  const maxTileX = clamp(Math.floor((cam.x + halfW) / tileSize), 0, cols - 1);
  const minTileY = clamp(Math.floor((cam.y - halfH) / tileSize), 0, rows - 1);
  const maxTileY = clamp(Math.floor((cam.y + halfH) / tileSize), 0, rows - 1);

  const { minChunkX, maxChunkX, minChunkY, maxChunkY } = updateVisibleChunks(minTileX, maxTileX, minTileY, maxTileY);

  for (let cy = minChunkY; cy <= maxChunkY; cy++) {
    const tileY0 = cy * CHUNK_TILES;
    const tileY1 = Math.min(tileY0 + CHUNK_TILES, rows);
    for (let cx = minChunkX; cx <= maxChunkX; cx++) {
      const tileX0 = cx * CHUNK_TILES;
      const tileX1 = Math.min(tileX0 + CHUNK_TILES, cols);
      if ((mapPixelWidth >= 16 * 64) || (mapPixelHeight >= 16 * 64)) {
        drawSprite({ sprite: `chunk-24`, pos: vec2(tileX0 * tileSize, tileY0 * tileSize), scale: 4 });
      }
      for (let y = tileY0; y < tileY1; y++) {
        for (let x = tileX0; x < tileX1; x++) {
          const idx = tileIndexAt(x, y);
          const px = x * tileSize;
          const py = y * tileSize;
          if ((mapPixelWidth < 16 * 64) || (mapPixelHeight < 16 * 64)) {
            const bgIdx = mapBgIdx[idx];
            if (bgIdx !== 0) drawSprite({ sprite: `tile-${bgIdx}`, pos: vec2(px, py), scale: 4 });
          }
          const fgIdx = mapFgIdx[idx];
          if (fgIdx !== 0) drawSprite({ sprite: `tile-${fgIdx}`, pos: vec2(px, py), scale: 4 });
        }
      }
    }
  }
});

// Modify mapOverlay.onDraw to render overlay sprites
mapOverlay.onDraw(() => {
  const cam = getCamPos();
  const halfW = width() / 2;
  const halfH = height() / 2;
  const minTileX = clamp(Math.floor((cam.x - halfW) / tileSize), 0, cols - 1);
  const maxTileX = clamp(Math.floor((cam.x + halfW) / tileSize), 0, cols - 1);
  const minTileY = clamp(Math.floor((cam.y - halfH) / tileSize), 0, rows - 1);
  const maxTileY = clamp(Math.floor((cam.y + halfH) / tileSize), 0, rows - 1);

  for (let y = minTileY; y <= maxTileY; y++) {
    for (let x = minTileX; x <= maxTileX; x++) {
      const idx = tileIndexAt(x, y);
      const overlayIdx = mapOverlayIdx[idx];
      if (overlayIdx) {
        drawSprite({
          sprite: `tile-${overlayIdx}`,
          pos: vec2(x * tileSize, y * tileSize),
          scale: 4
        });
      }
    }
  }
});