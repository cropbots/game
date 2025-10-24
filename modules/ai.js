// -----------------------------
// AI + Pathfinding (tile-based)
// -----------------------------

// NavMesh baker
function buildNavMesh() {
  const nodes = [];
  const nodeIndex = new Map();

  // Pass 1: collect walkable tiles
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = y * cols + x;
      if (colliderMask[idx] === 0) {
        const node = { x, y, neighbors: [] };
        nodeIndex.set(`${x},${y}`, nodes.length);
        nodes.push(node);
      }
    }
  }

  // Pass 2: link 4-way adjacency (no diagonals)
  const dirs = [
    [1, 0], [-1, 0],
    [0, 1], [0, -1],
  ];

  for (const node of nodes) {
    for (const [dx, dy] of dirs) {
      const nx = node.x + dx;
      const ny = node.y + dy;
      const key = `${nx},${ny}`;
      if (nodeIndex.has(key)) {
        node.neighbors.push(nodeIndex.get(key));
      }
    }
  }

  console.log(`✅ NavMesh baked: ${nodes.length} walkable tiles`);

  return { nodes, nodeIndex };
}

// Build the navmesh at startup
const navMesh = buildNavMesh();