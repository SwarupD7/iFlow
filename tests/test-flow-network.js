// ============================================================================
// DAA COURSE PROJECT — ALGORITHM TEST SUITE (FlowNetwork & Max-Flow / Min-Cut)
// Application: Campus Evacuation Capacity Analyzer
// Location: tests/test-flow-network.js
//
// Covers:
// 1. Single edge (source to sink)
// 2. Two independent parallel paths
// 3. Shared bottleneck graph
// 4. Augmenting path requiring residual reverse-edge rerouting
// 5. Disconnected source/sink network
// 6. Zero-capacity and throttled edges
// 7. Malformed input (self-loops, disconnected vertices)
// 8. Original generic 8-node example (Regression)
// 9. Evacuation Scenario 1: Normal Operation (23 people/min)
// 10. Evacuation Scenario 2: Blocked Staircase A (13 people/min)
// 11. Evacuation Scenario 3: Restricted North Exit (14 people/min)
// 12. Edmonds-Karp (BFS) vs Widest-Path (Priority Queue) consistency
// 13. Max-Flow Min-Cut Theorem invariant (Max Flow === Min-Cut Capacity)
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

// 1. Load Dependencies in VM context
const rootDir = path.resolve(__dirname, '..');
const lodashCode = fs.readFileSync(path.join(rootDir, 'vendor/js/lodash.js'), 'utf8');
vm.runInThisContext(lodashCode);
if (typeof _ === 'undefined' && typeof window !== 'undefined') {
  global._ = window._;
}

const pqCode = fs.readFileSync(path.join(rootDir, 'js/model/priority-queue.js'), 'utf8');
vm.runInThisContext(pqCode);

const mfCode = fs.readFileSync(path.join(rootDir, 'js/model/max-flow.js'), 'utf8');
vm.runInThisContext(mfCode);

// Helper solver using Edmonds-Karp (BFS augmenting paths)
function solveMaxFlowEdmondsKarp(initialFlowNet, originalEdgeList) {
  let currentSimFn = initialFlowNet;
  let totalFlow = 0;
  const paths = [];
  let safetyIterations = 0;

  while (safetyIterations++ < 100) {
    const pathNodes = currentSimFn.findShortestAugmentingPath();
    if (!pathNodes || pathNodes.length <= 1) break;

    const edgeList = currentSimFn.convertNodesToEdges(pathNodes);
    const [bottleneck, bottleneckEdge, pathMsg] = currentSimFn.findBottleneckCapacity(edgeList);
    if (bottleneck <= 0 || bottleneck === Infinity) break;

    const expectedGraph = currentSimFn.addFlow(edgeList, bottleneck, false);
    totalFlow += bottleneck;
    paths.push({ path: pathMsg, bottleneck });

    // Reconstruct residual FlowNetwork
    const nextFn = new FlowNetwork(initialFlowNet.source, initialFlowNet.sink);
    for (const [u, neighbors] of expectedGraph) {
      for (const [v, edge] of neighbors) {
        if (edge.capacity > 0) {
          nextFn.addEdge(u, v, edge.capacity);
        }
      }
    }
    currentSimFn = nextFn;
  }

  // Min-Cut extraction via DFS on residual graph
  const reachableFromSource = currentSimFn.findMinCut(currentSimFn.source);
  const minCutEdges = [];
  let cutCapacity = 0;

  for (const e of originalEdgeList) {
    if (e.capacity > 0 && reachableFromSource.has(e.source) && !reachableFromSource.has(e.target)) {
      minCutEdges.push(e);
      cutCapacity += e.capacity;
    }
  }

  return {
    maxFlow: totalFlow,
    cutCapacity: cutCapacity,
    cutEdges: minCutEdges,
    augmentingPaths: paths,
    reachableNodes: reachableFromSource
  };
}

// Helper solver using Widest Path heuristic (Priority Queue)
function solveMaxFlowWidestPath(initialFlowNet) {
  let currentSimFn = initialFlowNet;
  let totalFlow = 0;
  const paths = [];
  let safetyIterations = 0;

  while (safetyIterations++ < 100) {
    const pathNodes = currentSimFn.findWidestAugmentingPath();
    if (!pathNodes || pathNodes.length <= 1) break;

    const edgeList = currentSimFn.convertNodesToEdges(pathNodes);
    const [bottleneck, bottleneckEdge, pathMsg] = currentSimFn.findBottleneckCapacity(edgeList);
    if (bottleneck <= 0 || bottleneck === Infinity) break;

    const expectedGraph = currentSimFn.addFlow(edgeList, bottleneck, false);
    totalFlow += bottleneck;
    paths.push({ path: pathMsg, bottleneck });

    const nextFn = new FlowNetwork(initialFlowNet.source, initialFlowNet.sink);
    for (const [u, neighbors] of expectedGraph) {
      for (const [v, edge] of neighbors) {
        if (edge.capacity > 0) {
          nextFn.addEdge(u, v, edge.capacity);
        }
      }
    }
    currentSimFn = nextFn;
  }

  return { maxFlow: totalFlow, paths };
}

let testCount = 0;
let passedCount = 0;
let failedCount = 0;

function runTest(name, fn) {
  testCount++;
  process.stdout.write(`[Test ${testCount}] ${name} ... `);
  try {
    fn();
    passedCount++;
    console.log('PASSED \x1b[32m✔\x1b[0m');
  } catch (err) {
    failedCount++;
    console.log('FAILED \x1b[31m✖\x1b[0m');
    console.error(`   Error: ${err.message}`);
  }
}

console.log('================================================================');
console.log('  FLOW NETWORK & MAX-FLOW / MIN-CUT COMPREHENSIVE TEST SUITE    ');
console.log('================================================================');

// ----------------------------------------------------------------------------
// Test 1: Single Edge
// ----------------------------------------------------------------------------
runTest('Single Edge Graph (Source -> Sink, Cap: 7)', () => {
  const fn = new FlowNetwork('S', 'T');
  const edges = [{ source: 'S', target: 'T', capacity: 7 }];
  fn.addEdge('S', 'T', 7);

  const res = solveMaxFlowEdmondsKarp(fn, edges);
  assert.strictEqual(res.maxFlow, 7, 'Max flow must equal 7');
  assert.strictEqual(res.cutCapacity, 7, 'Min-cut capacity must equal 7');
  assert.strictEqual(res.cutEdges.length, 1, 'Exactly one min-cut edge');
  assert.strictEqual(res.cutEdges[0].source, 'S');
  assert.strictEqual(res.cutEdges[0].target, 'T');
});

// ----------------------------------------------------------------------------
// Test 2: Two Independent Parallel Paths
// ----------------------------------------------------------------------------
runTest('Two Independent Paths (S->A->T: 4, S->B->T: 6)', () => {
  const fn = new FlowNetwork('S', 'T');
  const edges = [
    { source: 'S', target: 'A', capacity: 4 },
    { source: 'A', target: 'T', capacity: 4 },
    { source: 'S', target: 'B', capacity: 6 },
    { source: 'B', target: 'T', capacity: 6 }
  ];
  edges.forEach(e => fn.addEdge(e.source, e.target, e.capacity));

  const res = solveMaxFlowEdmondsKarp(fn, edges);
  assert.strictEqual(res.maxFlow, 10, 'Max flow must equal 4 + 6 = 10');
  assert.strictEqual(res.cutCapacity, 10, 'Min-cut capacity must equal 10');
  assert.strictEqual(res.maxFlow, res.cutCapacity, 'Max Flow must equal Min-Cut capacity');
});

// ----------------------------------------------------------------------------
// Test 3: Shared Bottleneck Graph
// ----------------------------------------------------------------------------
runTest('Shared Bottleneck Graph (S->A: 10, S->B: 10, A->C: 5, B->C: 5, C->T: 6)', () => {
  const fn = new FlowNetwork('S', 'T');
  const edges = [
    { source: 'S', target: 'A', capacity: 10 },
    { source: 'S', target: 'B', capacity: 10 },
    { source: 'A', target: 'C', capacity: 5 },
    { source: 'B', target: 'C', capacity: 5 },
    { source: 'C', target: 'T', capacity: 6 }
  ];
  edges.forEach(e => fn.addEdge(e.source, e.target, e.capacity));

  const res = solveMaxFlowEdmondsKarp(fn, edges);
  assert.strictEqual(res.maxFlow, 6, 'Max flow must be limited by bottleneck C->T (6)');
  assert.strictEqual(res.cutCapacity, 6, 'Min-cut capacity must equal 6');
  assert.strictEqual(res.cutEdges.length, 1, 'Cut edge must be C->T');
  assert.strictEqual(res.cutEdges[0].source, 'C');
  assert.strictEqual(res.cutEdges[0].target, 'T');
});

// ----------------------------------------------------------------------------
// Test 4: Augmenting Path Requiring Residual Reverse-Edge Rerouting
// ----------------------------------------------------------------------------
runTest('Reverse Edge Rerouting (S->A: 10, S->B: 10, A->B: 1, A->T: 10, B->T: 10)', () => {
  // If an augmenting path S -> A -> B -> T (bottleneck 1) is chosen first,
  // it pushes 1 unit across A->B. The residual graph will then contain a reverse edge
  // B -> A with capacity 1. Subsequent augmentation along S -> B -> A -> T cancels the
  // cross-flow and allows both S->A->T and S->B->T to achieve full capacity (total 20).
  const fn = new FlowNetwork('S', 'T');
  const edges = [
    { source: 'S', target: 'A', capacity: 10 },
    { source: 'S', target: 'B', capacity: 10 },
    { source: 'A', target: 'B', capacity: 1 },
    { source: 'A', target: 'T', capacity: 10 },
    { source: 'B', target: 'T', capacity: 10 }
  ];
  edges.forEach(e => fn.addEdge(e.source, e.target, e.capacity));

  // Force first augmentation through S->A->B->T
  const forcedPath = fn.convertNodesToEdges(['S', 'A', 'B', 'T']);
  fn.addFlow(forcedPath, 1, true);

  // Verify reverse edge B -> A has capacity 1 in residual graph
  assert.strictEqual(fn.graph.get('B').get('A').capacity, 1, 'Residual reverse edge B->A must have capacity 1');

  // Now continue Edmonds-Karp to completion
  const res = solveMaxFlowEdmondsKarp(fn, edges);
  // Total flow must be 1 (forced) + 19 (remaining) = 20
  assert.strictEqual(1 + res.maxFlow, 20, 'Total max flow with reverse rerouting must equal 20');
});

// ----------------------------------------------------------------------------
// Test 5: Disconnected Graph
// ----------------------------------------------------------------------------
runTest('Disconnected Network (S->A: 5, B->T: 5, No passage between A and B)', () => {
  const fn = new FlowNetwork('S', 'T');
  const edges = [
    { source: 'S', target: 'A', capacity: 5 },
    { source: 'B', target: 'T', capacity: 5 }
  ];
  edges.forEach(e => fn.addEdge(e.source, e.target, e.capacity));

  const res = solveMaxFlowEdmondsKarp(fn, edges);
  assert.strictEqual(res.maxFlow, 0, 'Max flow of disconnected network must be 0');
  assert.strictEqual(res.cutCapacity, 0, 'Min-cut capacity across disconnected network must be 0');
  assert.strictEqual(res.cutEdges.length, 0, 'No cut edges with capacity > 0 can cross the cut');
});

// ----------------------------------------------------------------------------
// Test 6: Zero-Capacity and Throttled Edges
// ----------------------------------------------------------------------------
runTest('Zero-Capacity Blocked Edges (S->A: 10, A->T: 0, S->B: 5, B->T: 5)', () => {
  const fn = new FlowNetwork('S', 'T');
  const edges = [
    { source: 'S', target: 'A', capacity: 10 },
    { source: 'A', target: 'T', capacity: 0 },
    { source: 'S', target: 'B', capacity: 5 },
    { source: 'B', target: 'T', capacity: 5 }
  ];
  edges.forEach(e => fn.addEdge(e.source, e.target, e.capacity));

  const res = solveMaxFlowEdmondsKarp(fn, edges);
  assert.strictEqual(res.maxFlow, 5, 'Flow must not traverse 0-capacity edge A->T');
  assert.strictEqual(res.cutCapacity, 5, 'Min-cut capacity must equal 5');
});

// ----------------------------------------------------------------------------
// Test 7: Malformed Input (Self-loops and Isolated Nodes)
// ----------------------------------------------------------------------------
runTest('Malformed Input Handling (Self-loop S->S, Isolated node C)', () => {
  const fn = new FlowNetwork('S', 'T');
  // Add self loop — FlowNetwork.addEdge guards against this: if (source == target) return;
  fn.addEdge('S', 'S', 10);
  assert.strictEqual(fn.hasEdge('S', 'S'), false, 'Self-loop must be rejected by FlowNetwork');

  // Add isolated node C
  fn.addNode('C');
  assert.strictEqual(fn.graph.has('C'), true, 'Isolated node C added to graph');

  // Add normal path S->T
  fn.addEdge('S', 'T', 8);
  const edges = [{ source: 'S', target: 'T', capacity: 8 }];
  const res = solveMaxFlowEdmondsKarp(fn, edges);
  assert.strictEqual(res.maxFlow, 8, 'Max flow unaffected by isolated node');
});

// ----------------------------------------------------------------------------
// Test 8: Generic 8-Node Example (Regression)
// ----------------------------------------------------------------------------
runTest('Generic 8-Node Example (Source: 1, Sink: 8, Expected: 11)', () => {
  const fn = new FlowNetwork(1, 8);
  const edges = [
    { source: 1, target: 2, capacity: 6 },
    { source: 1, target: 3, capacity: 6 },
    { source: 2, target: 4, capacity: 4 },
    { source: 2, target: 5, capacity: 2 },
    { source: 3, target: 2, capacity: 5 },
    { source: 3, target: 5, capacity: 9 },
    { source: 4, target: 7, capacity: 7 },
    { source: 4, target: 6, capacity: 4 },
    { source: 5, target: 4, capacity: 8 },
    { source: 5, target: 7, capacity: 7 },
    { source: 6, target: 8, capacity: 7 },
    { source: 7, target: 6, capacity: 11 },
    { source: 7, target: 8, capacity: 4 }
  ];
  edges.forEach(e => fn.addEdge(e.source, e.target, e.capacity));

  const res = solveMaxFlowEdmondsKarp(fn, edges);
  assert.strictEqual(res.maxFlow, 11, 'Generic Example max flow must equal 11');
  assert.strictEqual(res.cutCapacity, 11, 'Min-cut capacity must equal 11');
  assert.strictEqual(res.maxFlow, res.cutCapacity, 'Max Flow equals Min-Cut theorem');
});

// ----------------------------------------------------------------------------
// Test 9: Scenario 1: Normal Operation (Baseline)
// ----------------------------------------------------------------------------
const EVAC_BASELINE_EDGES = [
  { source: 1, target: 2, capacity: 10 },
  { source: 1, target: 3, capacity: 8 },
  { source: 1, target: 4, capacity: 7 },
  { source: 2, target: 5, capacity: 8 },
  { source: 3, target: 5, capacity: 5 },
  { source: 3, target: 6, capacity: 4 },
  { source: 4, target: 6, capacity: 7 },
  { source: 5, target: 7, capacity: 10 },
  { source: 5, target: 8, capacity: 4 },
  { source: 6, target: 8, capacity: 3 },
  { source: 6, target: 9, capacity: 8 },
  { source: 7, target: 10, capacity: 10 },
  { source: 8, target: 10, capacity: 3 },
  { source: 8, target: 11, capacity: 3 },
  { source: 9, target: 11, capacity: 7 },
  { source: 10, target: 12, capacity: 13 },
  { source: 11, target: 12, capacity: 10 }
];

runTest('Scenario 1: Normal Operation (Expected: 23 people/min)', () => {
  const fn = new FlowNetwork(1, 12);
  EVAC_BASELINE_EDGES.forEach(e => fn.addEdge(e.source, e.target, e.capacity));

  const res = solveMaxFlowEdmondsKarp(fn, EVAC_BASELINE_EDGES);
  assert.strictEqual(res.maxFlow, 23, 'Normal Operation max flow must equal 23');
  assert.strictEqual(res.cutCapacity, 23, 'Normal Operation min-cut capacity must equal 23');
  assert.strictEqual(res.maxFlow, res.cutCapacity, 'Max Flow must equal Min-Cut capacity');

  // Verify cut edges: 1->3 (8), 1->4 (7), 2->5 (8) => total 23
  const cutEdgePairs = res.cutEdges.map(e => `${e.source}->${e.target}`);
  assert.ok(cutEdgePairs.includes('1->3'), 'Cut must include 1->3');
  assert.ok(cutEdgePairs.includes('1->4'), 'Cut must include 1->4');
  assert.ok(cutEdgePairs.includes('2->5'), 'Cut must include 2->5');
});

// ----------------------------------------------------------------------------
// Test 10: Scenario 2: Blocked Staircase A
// ----------------------------------------------------------------------------
runTest('Scenario 2: Blocked Staircase A (5->7 Cap: 0, Expected: 13 people/min)', () => {
  const fn = new FlowNetwork(1, 12);
  const scenarioEdges = EVAC_BASELINE_EDGES.map(e => {
    if (e.source === 5 && e.target === 7) return { ...e, capacity: 0 };
    return { ...e };
  });
  scenarioEdges.forEach(e => fn.addEdge(e.source, e.target, e.capacity));

  const res = solveMaxFlowEdmondsKarp(fn, scenarioEdges);
  assert.strictEqual(res.maxFlow, 13, 'Blocked Staircase max flow must equal 13');
  assert.strictEqual(res.cutCapacity, 13, 'Blocked Staircase min-cut capacity must equal 13');
  assert.strictEqual(res.maxFlow, res.cutCapacity, 'Max Flow must equal Min-Cut capacity');

  // Verify cut edges: 8->10 (3), 8->11 (3), 9->11 (7) => total 13
  const cutEdgePairs = res.cutEdges.map(e => `${e.source}->${e.target}`);
  assert.ok(cutEdgePairs.includes('8->10'), 'Cut must include 8->10');
  assert.ok(cutEdgePairs.includes('8->11'), 'Cut must include 8->11');
  assert.ok(cutEdgePairs.includes('9->11'), 'Cut must include 9->11');
});

// ----------------------------------------------------------------------------
// Test 11: Scenario 3: Restricted North Exit
// ----------------------------------------------------------------------------
runTest('Scenario 3: Restricted North Exit (10->12 Cap: 4, Expected: 14 people/min)', () => {
  const fn = new FlowNetwork(1, 12);
  const scenarioEdges = EVAC_BASELINE_EDGES.map(e => {
    if (e.source === 10 && e.target === 12) return { ...e, capacity: 4 };
    return { ...e };
  });
  scenarioEdges.forEach(e => fn.addEdge(e.source, e.target, e.capacity));

  const res = solveMaxFlowEdmondsKarp(fn, scenarioEdges);
  assert.strictEqual(res.maxFlow, 14, 'Restricted Exit max flow must equal 14');
  assert.strictEqual(res.cutCapacity, 14, 'Restricted Exit min-cut capacity must equal 14');
  assert.strictEqual(res.maxFlow, res.cutCapacity, 'Max Flow must equal Min-Cut capacity');

  // Verify cut edges: 8->11 (3), 9->11 (7), 10->12 (4) => total 14
  const cutEdgePairs = res.cutEdges.map(e => `${e.source}->${e.target}`);
  assert.ok(cutEdgePairs.includes('8->11'), 'Cut must include 8->11');
  assert.ok(cutEdgePairs.includes('9->11'), 'Cut must include 9->11');
  assert.ok(cutEdgePairs.includes('10->12'), 'Cut must include 10->12');
});

// ----------------------------------------------------------------------------
// Test 12: Edmonds-Karp (BFS) vs Widest Path Heuristic Consistency
// ----------------------------------------------------------------------------
runTest('Algorithm Consistency: Edmonds-Karp vs Widest Path on all 3 scenarios', () => {
  // Scenario 1
  const fn1_bfs = new FlowNetwork(1, 12);
  const fn1_wp = new FlowNetwork(1, 12);
  EVAC_BASELINE_EDGES.forEach(e => {
    fn1_bfs.addEdge(e.source, e.target, e.capacity);
    fn1_wp.addEdge(e.source, e.target, e.capacity);
  });
  const res1_bfs = solveMaxFlowEdmondsKarp(fn1_bfs, EVAC_BASELINE_EDGES);
  const res1_wp = solveMaxFlowWidestPath(fn1_wp);
  assert.strictEqual(res1_bfs.maxFlow, res1_wp.maxFlow, 'Scenario 1 BFS vs Widest Path max flow must agree');
  assert.strictEqual(res1_wp.maxFlow, 23, 'Widest path must compute 23 on Scenario 1');

  // Scenario 2
  const edges2 = EVAC_BASELINE_EDGES.map(e => (e.source === 5 && e.target === 7 ? { ...e, capacity: 0 } : { ...e }));
  const fn2_bfs = new FlowNetwork(1, 12);
  const fn2_wp = new FlowNetwork(1, 12);
  edges2.forEach(e => {
    fn2_bfs.addEdge(e.source, e.target, e.capacity);
    fn2_wp.addEdge(e.source, e.target, e.capacity);
  });
  const res2_bfs = solveMaxFlowEdmondsKarp(fn2_bfs, edges2);
  const res2_wp = solveMaxFlowWidestPath(fn2_wp);
  assert.strictEqual(res2_bfs.maxFlow, res2_wp.maxFlow, 'Scenario 2 BFS vs Widest Path max flow must agree');
  assert.strictEqual(res2_wp.maxFlow, 13, 'Widest path must compute 13 on Scenario 2');

  // Scenario 3
  const edges3 = EVAC_BASELINE_EDGES.map(e => (e.source === 10 && e.target === 12 ? { ...e, capacity: 4 } : { ...e }));
  const fn3_bfs = new FlowNetwork(1, 12);
  const fn3_wp = new FlowNetwork(1, 12);
  edges3.forEach(e => {
    fn3_bfs.addEdge(e.source, e.target, e.capacity);
    fn3_wp.addEdge(e.source, e.target, e.capacity);
  });
  const res3_bfs = solveMaxFlowEdmondsKarp(fn3_bfs, edges3);
  const res3_wp = solveMaxFlowWidestPath(fn3_wp);
  assert.strictEqual(res3_bfs.maxFlow, res3_wp.maxFlow, 'Scenario 3 BFS vs Widest Path max flow must agree');
  assert.strictEqual(res3_wp.maxFlow, 14, 'Widest path must compute 14 on Scenario 3');
});

console.log('----------------------------------------------------------------');
console.log(`SUMMARY: ${passedCount} / ${testCount} tests passed (${failedCount} failed)`);
console.log('================================================================\n');

if (failedCount > 0) {
  process.exit(1);
}
