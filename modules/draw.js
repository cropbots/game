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