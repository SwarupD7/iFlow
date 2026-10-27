// ============================================================================
// GRAPH GENERATORS — Phase 7 Benchmarking
// Application: Campus Evacuation Capacity Analyzer
// File: benchmarks/graph-generators.js
//
// Provides deterministic, seeded graph generation for reproducible benchmarks.
// All generators return networkDef objects compatible with flow-solvers.js:
//   { source, sink, edges: [{ id, source, target, capacity }] }
//
// Generator families:
//   1. Sparse directed — |E| ≈ 2·|V|
//   2. Dense directed  — |E| ≈ |V|·(|V|-1)/4
//   3. Grid / room-corridor — rows × cols lattice
//   4. Layered / DAG   — layers with inter-layer edges
//   5. Capacity-range   — fixed structure, varying cap range
//
// PRNG: xorshift128 with configurable 32-bit seed for full reproducibility.
// ============================================================================

// ---------------------------------------------------------------------------
// Seeded PRNG: xorshift128
// Returns a function () => number in [0, 1) with period ~ 2^128
// ---------------------------------------------------------------------------
function createPRNG(seed) {
  // Initialise four 32-bit state variables from the single seed
  let s0 = seed >>> 0 || 1;
  let s1 = (seed * 1103515245 + 12345) >>> 0 || 2;
  let s2 = (seed * 214013 + 2531011) >>> 0 || 3;
  let s3 = (seed * 48271) >>> 0 || 4;

  // Warm up state
  for (let i = 0; i < 20; i++) {
    const t = s0 ^ (s0 << 11);
    s0 = s1; s1 = s2; s2 = s3;
    s3 = (s3 ^ (s3 >>> 19)) ^ (t ^ (t >>> 8));
  }

  return function () {
    const t = s0 ^ (s0 << 11);
    s0 = s1; s1 = s2; s2 = s3;
    s3 = (s3 ^ (s3 >>> 19)) ^ (t ^ (t >>> 8));
    return (s3 >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Helper: generate a random integer in [lo, hi] inclusive using PRNG
// ---------------------------------------------------------------------------
function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

// ---------------------------------------------------------------------------
// Helper: Fisher-Yates shuffle in-place using PRNG
// ---------------------------------------------------------------------------
function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

// ---------------------------------------------------------------------------
// 1. generateSparse(n, seed, capRange)
//    Sparse directed graph with |V| = n, |E| ≈ 2*n.
//    Ensures reachability: Hamiltonian path from source to sink,
//    then random extra edges to reach target density.
// ---------------------------------------------------------------------------
function generateSparse(n, seed, capRange) {
  if (n < 2) throw new Error('generateSparse: n must be >= 2');
  seed = seed || 42;
  capRange = capRange || [1, 100];
  const rng = createPRNG(seed);

  const nodes = [];
  for (let i = 0; i < n; i++) nodes.push(i);
  shuffle(rng, nodes);

  const source = String(nodes[0]);
  const sink = String(nodes[n - 1]);
  const edges = [];
  const edgeSet = new Set();
  let eid = 0;

  function addEdge(u, v) {
    const key = u + ':' + v;
    if (u === v || edgeSet.has(key)) return false;
    edgeSet.add(key);
    edges.push({
      id: 'e' + eid++,
      source: String(u),
      target: String(v),
      capacity: randInt(rng, capRange[0], capRange[1])
    });
    return true;
  }

  // Hamiltonian path ensures source-to-sink reachability
  for (let i = 0; i < n - 1; i++) {
    addEdge(nodes[i], nodes[i + 1]);
  }

  // Add random edges up to ≈ 2*n total
  const targetEdges = Math.min(2 * n, n * (n - 1));
  let attempts = 0;
  while (edges.length < targetEdges && attempts < targetEdges * 10) {
    const u = nodes[Math.floor(rng() * n)];
    const v = nodes[Math.floor(rng() * n)];
    addEdge(u, v);
    attempts++;
  }

  return {
    source, sink, edges,
    meta: {
      family: 'sparse',
      vertices: n,
      edgeCount: edges.length,
      seed,
      capRange
    }
  };
}

// ---------------------------------------------------------------------------
// 2. generateDense(n, seed, capRange)
//    Dense directed graph with |V| = n.
//    Adds Hamiltonian path plus each directed pair with probability ~0.5,
//    yielding |E| / (n * (n - 1)) ≈ 50–60% directed edge density.
// ---------------------------------------------------------------------------
function generateDense(n, seed, capRange) {
  if (n < 2) throw new Error('generateDense: n must be >= 2');
  seed = seed || 42;
  capRange = capRange || [1, 100];
  const rng = createPRNG(seed);

  const nodes = [];
  for (let i = 0; i < n; i++) nodes.push(i);
  shuffle(rng, nodes);

  const source = String(nodes[0]);
  const sink = String(nodes[n - 1]);
  const edges = [];
  const edgeSet = new Set();
  let eid = 0;

  function addEdge(u, v) {
    const key = u + ':' + v;
    if (u === v || edgeSet.has(key)) return false;
    edgeSet.add(key);
    edges.push({
      id: 'e' + eid++,
      source: String(u),
      target: String(v),
      capacity: randInt(rng, capRange[0], capRange[1])
    });
    return true;
  }

  // Ensure reachability via Hamiltonian path
  for (let i = 0; i < n - 1; i++) {
    addEdge(nodes[i], nodes[i + 1]);
  }

  // Add edges with ~50% probability for each ordered pair
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && rng() < 0.5) {
        addEdge(nodes[i], nodes[j]);
      }
    }
  }

  return {
    source, sink, edges,
    meta: {
      family: 'dense',
      vertices: n,
      edgeCount: edges.length,
      seed,
      capRange
    }
  };
}

// ---------------------------------------------------------------------------
// 3. generateGrid(rows, cols, seed, capRange)
//    Grid / room-corridor graph: rows × cols lattice.
//    Source = (0,0), Sink = (rows-1, cols-1).
//    Right and down edges always present; up/left edges with 30% probability.
// ---------------------------------------------------------------------------
function generateGrid(rows, cols, seed, capRange) {
  if (rows < 1 || cols < 1) throw new Error('generateGrid: rows and cols must be >= 1');
  seed = seed || 42;
  capRange = capRange || [1, 100];
  const rng = createPRNG(seed);

  const nodeId = (r, c) => String(r * cols + c);
  const source = nodeId(0, 0);
  const sink = nodeId(rows - 1, cols - 1);
  const edges = [];
  let eid = 0;
  const edgeSet = new Set();

  function addEdge(u, v) {
    const key = u + ':' + v;
    if (u === v || edgeSet.has(key)) return false;
    edgeSet.add(key);
    edges.push({
      id: 'e' + eid++,
      source: u,
      target: v,
      capacity: randInt(rng, capRange[0], capRange[1])
    });
    return true;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Right
      if (c + 1 < cols) addEdge(nodeId(r, c), nodeId(r, c + 1));
      // Down
      if (r + 1 < rows) addEdge(nodeId(r, c), nodeId(r + 1, c));
      // Left (with probability)
      if (c > 0 && rng() < 0.3) addEdge(nodeId(r, c), nodeId(r, c - 1));
      // Up (with probability)
      if (r > 0 && rng() < 0.3) addEdge(nodeId(r, c), nodeId(r - 1, c));
    }
  }

  return {
    source, sink, edges,
    meta: {
      family: 'grid',
      rows, cols,
      vertices: rows * cols,
      edgeCount: edges.length,
      seed,
      capRange
    }
  };
}

// ---------------------------------------------------------------------------
// 4. generateLayered(layers, nodesPerLayer, seed, capRange)
//    Layered / DAG: nodes in L layers, edges only from layer i to layer i+1.
//    Source = single node in layer 0; Sink = single node in last layer.
//    Each node in layer i connects to ~60% of nodes in layer i+1.
// ---------------------------------------------------------------------------
function generateLayered(layers, nodesPerLayer, seed, capRange) {
  if (layers < 2) throw new Error('generateLayered: layers must be >= 2');
  if (nodesPerLayer < 1) throw new Error('generateLayered: nodesPerLayer must be >= 1');
  seed = seed || 42;
  capRange = capRange || [1, 100];
  const rng = createPRNG(seed);

  // Build layer arrays. Layer 0 has 1 node (source), last has 1 (sink).
  const layerNodes = [];
  let nodeCounter = 0;

  // Source layer
  layerNodes.push([String(nodeCounter++)]);

  // Intermediate layers
  for (let l = 1; l < layers - 1; l++) {
    const layer = [];
    for (let k = 0; k < nodesPerLayer; k++) {
      layer.push(String(nodeCounter++));
    }
    layerNodes.push(layer);
  }

  // Sink layer
  layerNodes.push([String(nodeCounter++)]);

  const source = layerNodes[0][0];
  const sink = layerNodes[layerNodes.length - 1][0];
  const edges = [];
  let eid = 0;

  for (let l = 0; l < layerNodes.length - 1; l++) {
    const fromLayer = layerNodes[l];
    const toLayer = layerNodes[l + 1];

    for (const u of fromLayer) {
      let connected = false;
      for (const v of toLayer) {
        if (rng() < 0.6) {
          edges.push({
            id: 'e' + eid++,
            source: u,
            target: v,
            capacity: randInt(rng, capRange[0], capRange[1])
          });
          connected = true;
        }
      }
      // Ensure at least one outgoing edge per node
      if (!connected) {
        const v = toLayer[Math.floor(rng() * toLayer.length)];
        edges.push({
          id: 'e' + eid++,
          source: u,
          target: v,
          capacity: randInt(rng, capRange[0], capRange[1])
        });
      }
    }

    // Ensure at least one incoming edge per node in next layer
    for (const v of toLayer) {
      const hasIncoming = edges.some(e => e.target === v && fromLayer.includes(e.source));
      if (!hasIncoming) {
        const u = fromLayer[Math.floor(rng() * fromLayer.length)];
        edges.push({
          id: 'e' + eid++,
          source: u,
          target: v,
          capacity: randInt(rng, capRange[0], capRange[1])
        });
      }
    }
  }

  const totalVertices = layerNodes.reduce((s, l) => s + l.length, 0);

  return {
    source, sink, edges,
    meta: {
      family: 'layered',
      layers: layerNodes.length,
      nodesPerLayer,
      vertices: totalVertices,
      edgeCount: edges.length,
      seed,
      capRange
    }
  };
}

// ---------------------------------------------------------------------------
// 5. generateCapacityVariant(baseGenerator, baseArgs, capRange, seed)
//    Takes a base generator + args, but overrides the capacity range.
//    Useful for capacity-range experiments on a fixed graph structure.
// ---------------------------------------------------------------------------
function generateCapacityVariant(baseGenerator, baseArgs, capRange, seed) {
  // Deep clone baseArgs and override capRange and seed
  const args = baseArgs.slice();
  // Last two positional args are always seed and capRange
  if (baseGenerator === generateSparse || baseGenerator === generateDense) {
    return baseGenerator(args[0], seed || args[1], capRange);
  } else if (baseGenerator === generateGrid) {
    return baseGenerator(args[0], args[1], seed || args[2], capRange);
  } else if (baseGenerator === generateLayered) {
    return baseGenerator(args[0], args[1], seed || args[2], capRange);
  }
  throw new Error('Unknown base generator');
}

// ---------------------------------------------------------------------------
// Deep-copy a networkDef to ensure each solver run gets a fresh copy
// ---------------------------------------------------------------------------
function cloneNetworkDef(net) {
  return {
    source: net.source,
    sink: net.sink,
    edges: net.edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      capacity: e.capacity
    })),
    meta: net.meta ? Object.assign({}, net.meta) : undefined
  };
}

// ---------------------------------------------------------------------------
// Node.js / browser dual-export
// ---------------------------------------------------------------------------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createPRNG,
    randInt,
    shuffle,
    generateSparse,
    generateDense,
    generateGrid,
    generateLayered,
    generateCapacityVariant,
    cloneNetworkDef
  };
}
