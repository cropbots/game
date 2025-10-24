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
