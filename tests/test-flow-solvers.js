// ============================================================================
// DAA COURSE PROJECT — FLOW SOLVERS TEST SUITE (Phase 6 Metrics & Traces)
// Application: Campus Evacuation Capacity Analyzer
// Location: tests/test-flow-solvers.js
//
// Tests the three standalone solvers in js/model/flow-solvers.js:
//   1. solveEdmondsKarp   — BFS (Shortest augmenting path)
//   2. solveFordFulkerson — deterministic iterative DFS
//   3. solveWidestPath    — Priority Queue (Fat-path / modified Dijkstra)
//
// 28 comprehensive test cases:
//   TC-01  Single edge graph
//   TC-02  Two independent parallel paths
//   TC-03  Shared bottleneck (diamond)
//   TC-04  Residual-edge rerouting required
//   TC-05  Disconnected source/sink (max flow = 0)
//   TC-06  Zero-capacity / throttled edges only
//   TC-07  Self-loop edges (ignored in residual, preserved in output)
//   TC-08  All three solvers agree on classic 6-node textbook graph (CLRS)
//   TC-09  Scenario 1: Normal Operation (expected 23 people/min)
//   TC-10  Scenario 2: Blocked Staircase A (expected 13 people/min)
//   TC-11  Scenario 3: Restricted North Exit (expected 14 people/min)
//   TC-12  verifySolverResult 9-invariant correctness check (positive case)
//   TC-13  Error result for invalid networkDef (missing source)
//   TC-14  Parallel original edges with distinct IDs & flow distribution
//   TC-15  Bidirectional edges between same vertex pair (opposing directions)
//   TC-16  Combination of parallel edges and residual reverse-edge rerouting
//   TC-17  Zero-capacity edges and self-loops output preservation
//   TC-18  Exhaustive cut-enumeration oracle comparison (multi-graph)
//   TC-19  Malformed inputs rejection (missing terminals, endpoints, neg/NaN cap, dup IDs)
//   TC-20  Floating-point / non-integer capacities (tolerance handling)
//   TC-21  Verifier failure detection (tampered solutions caught by individual checks)
//   TC-22  Phase 6: Standardized metrics completeness & non-negativity across all solvers
//   TC-23  Phase 6: Search attempts counting (k+1 optimality proof, disconnected, error)
//   TC-24  Phase 6: Edge examinations counting convention consistency
//   TC-25  Phase 6: Step-level execution trace connectivity and residual transitions
//   TC-26  Phase 6: Reverse-edge rerouting / flow cancellation explicit step trace
//   TC-27  Phase 6: Max iterations safety cap and INCOMPLETE status handling
//   TC-28  Phase 6: Verifier failure detection on tampered step traces
// ============================================================================

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const assert = require('assert');

// ---------------------------------------------------------------------------
// Load flow-solvers.js via vm.runInThisContext (consistent with other suites)
// ---------------------------------------------------------------------------
const rootDir = path.resolve(__dirname, '..');
const solversCode = fs.readFileSync(
  path.join(rootDir, 'js/model/flow-solvers.js'), 'utf8'
);
vm.runInThisContext(solversCode);

// Verify symbols are in scope
if (typeof solveEdmondsKarp        === 'undefined') throw new Error('solveEdmondsKarp not loaded');
if (typeof solveFordFulkerson      === 'undefined') throw new Error('solveFordFulkerson not loaded');
if (typeof solveWidestPath         === 'undefined') throw new Error('solveWidestPath not loaded');
if (typeof verifySolverResult      === 'undefined') throw new Error('verifySolverResult not loaded');
if (typeof exhaustiveMinCutOracle  === 'undefined') throw new Error('exhaustiveMinCutOracle not loaded');

// ---------------------------------------------------------------------------
// Test Utilities
// ---------------------------------------------------------------------------
let testCount   = 0;
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

// Convenience: assert a single solver result (status OPTIMAL, matching flow, all invariants)
function assertOptimal(result, expectedFlow, label) {
  assert.strictEqual(result.status, 'OPTIMAL',
    `${label}: status must be OPTIMAL (got ${result.status}: ${result.errorMessage})`);
  assert.strictEqual(Math.abs(result.maxFlow - expectedFlow) < 1e-9, true,
    `${label}: maxFlow must be ${expectedFlow} (got ${result.maxFlow})`);
  assert.strictEqual(Math.abs(result.cutCapacity - expectedFlow) < 1e-9, true,
    `${label}: cutCapacity must equal maxFlow=${expectedFlow} (got ${result.cutCapacity})`);
  assert.strictEqual(result.isCorrect, true,
    `${label}: verifySolverResult must pass — errors: ${result.verifierErrors.join('; ')}`);
  assert.ok(Array.isArray(result.edgeFlows), `${label}: edgeFlows must be an array`);
  assert.ok(Array.isArray(result.sourcePartition), `${label}: sourcePartition must be an array`);
  assert.ok(Array.isArray(result.sinkPartition), `${label}: sinkPartition must be an array`);
  assert.ok(result.metrics && typeof result.metrics.edgeExaminations === 'number',
    `${label}: metrics.edgeExaminations must be present`);
}

// Run all three solvers and assert they all agree
function assertAllSolversAgree(networkDef, expectedFlow, label) {
  const ek  = solveEdmondsKarp(networkDef);
  const ff  = solveFordFulkerson(networkDef);
  const wp  = solveWidestPath(networkDef);
  assertOptimal(ek,  expectedFlow, `EK  ${label}`);
  assertOptimal(ff,  expectedFlow, `FF  ${label}`);
  assertOptimal(wp,  expectedFlow, `WP  ${label}`);
  assert.strictEqual(Math.abs(ek.maxFlow - ff.maxFlow) < 1e-9, true,
    `${label}: EK and FF maxFlow must agree`);
  assert.strictEqual(Math.abs(ek.maxFlow - wp.maxFlow) < 1e-9, true,
    `${label}: EK and WP maxFlow must agree`);
}

// ---------------------------------------------------------------------------
// Shared test network definitions
// ---------------------------------------------------------------------------

// TC-01: Single edge, capacity 7
const NET_SINGLE_EDGE = {
  source: 'S', sink: 'T',
  edges: [{ id: 'e1', source: 'S', target: 'T', capacity: 7 }]
};

// TC-02: Two independent paths S→A→T (cap 4) and S→B→T (cap 6)
const NET_TWO_PATHS = {
  source: 'S', sink: 'T',
  edges: [
    { id: 'e1', source: 'S', target: 'A', capacity: 4 },
    { id: 'e2', source: 'A', target: 'T', capacity: 4 },
    { id: 'e3', source: 'S', target: 'B', capacity: 6 },
    { id: 'e4', source: 'B', target: 'T', capacity: 6 }
  ]
};

// TC-03: Diamond / shared bottleneck
//   S→A (10), S→B (5), A→B (3), A→T (8), B→T (6)
//   Paths: S→A→T = 8, S→B→T = 5, S→A→B→T = 1  =>  max flow = 14
const NET_DIAMOND = {
  source: 'S', sink: 'T',
  edges: [
    { id: 'e1', source: 'S', target: 'A', capacity: 10 },
    { id: 'e2', source: 'S', target: 'B', capacity: 5  },
    { id: 'e3', source: 'A', target: 'B', capacity: 3  },
    { id: 'e4', source: 'A', target: 'T', capacity: 8  },
    { id: 'e5', source: 'B', target: 'T', capacity: 6  }
  ]
};

// TC-04: Classic residual-edge rerouting example
//   S→A (10), S→B (10), A→B (1), A→T (10), B→T (10)  => max = 20
const NET_REROUTE = {
  source: 'S', sink: 'T',
  edges: [
    { id: 'e1', source: 'S', target: 'A', capacity: 10 },
    { id: 'e2', source: 'S', target: 'B', capacity: 10 },
    { id: 'e3', source: 'A', target: 'B', capacity: 1  },
    { id: 'e4', source: 'A', target: 'T', capacity: 10 },
    { id: 'e5', source: 'B', target: 'T', capacity: 10 }
  ]
};

// TC-05: Disconnected — no path from source to sink
const NET_DISCONNECTED = {
  source: 'S', sink: 'T',
  edges: [
    { id: 'e1', source: 'S', target: 'A', capacity: 5 },
    { id: 'e2', source: 'B', target: 'T', capacity: 5 }
  ]
};

// TC-06: Zero-capacity edges (and one real path)
const NET_ZERO_CAP = {
  source: 'S', sink: 'T',
  edges: [
    { id: 'e1', source: 'S', target: 'A', capacity: 0 },
    { id: 'e2', source: 'A', target: 'T', capacity: 0 },
    { id: 'e3', source: 'S', target: 'T', capacity: 4 }
  ]
};

// TC-07: Contains self-loop (ignored in search, preserved in output), valid path alongside
const NET_SELFLOOP = {
  source: 'S', sink: 'T',
  edges: [
    { id: 'e1', source: 'S', target: 'S', capacity: 99 },
    { id: 'e2', source: 'S', target: 'T', capacity: 6  }
  ]
};

// TC-08: Classic 6-node textbook graph (CLRS example)
//   Max flow = 23
const NET_CLRS = {
  source: 's', sink: 't',
  edges: [
    { id: 'e1', source: 's', target: 'v1', capacity: 16 },
    { id: 'e2', source: 's', target: 'v2', capacity: 13 },
    { id: 'e3', source: 'v1', target: 'v2', capacity: 10 },
    { id: 'e4', source: 'v1', target: 'v3', capacity: 12 },
    { id: 'e5', source: 'v2', target: 'v1', capacity: 4  },
    { id: 'e6', source: 'v2', target: 'v4', capacity: 14 },
    { id: 'e7', source: 'v3', target: 'v2', capacity: 9  },
    { id: 'e8', source: 'v3', target: 't',  capacity: 20 },
    { id: 'e9', source: 'v4', target: 'v3', capacity: 7  },
    { id: 'e10', source: 'v4', target: 't', capacity: 4  }
  ]
};

// ---------------------------------------------------------------------------
// Inline evacuation network definitions (mirrors EVACUATION_BASELINE_EDGES)
// ---------------------------------------------------------------------------
const EVAC_EDGES_BASELINE = [
  { id: '1-2',  source: 1,  target: 2,  capacity: 10 },
  { id: '1-3',  source: 1,  target: 3,  capacity: 8  },
  { id: '1-4',  source: 1,  target: 4,  capacity: 7  },
  { id: '2-5',  source: 2,  target: 5,  capacity: 8  },
  { id: '3-5',  source: 3,  target: 5,  capacity: 5  },
  { id: '3-6',  source: 3,  target: 6,  capacity: 4  },
  { id: '4-6',  source: 4,  target: 6,  capacity: 7  },
  { id: '5-7',  source: 5,  target: 7,  capacity: 10 },
  { id: '5-8',  source: 5,  target: 8,  capacity: 4  },
  { id: '6-8',  source: 6,  target: 8,  capacity: 3  },
  { id: '6-9',  source: 6,  target: 9,  capacity: 8  },
  { id: '7-10', source: 7,  target: 10, capacity: 10 },
  { id: '8-10', source: 8,  target: 10, capacity: 3  },
  { id: '8-11', source: 8,  target: 11, capacity: 3  },
  { id: '9-11', source: 9,  target: 11, capacity: 7  },
  { id: '10-12', source: 10, target: 12, capacity: 13 },
  { id: '11-12', source: 11, target: 12, capacity: 10 }
];

const NET_EVAC_NORMAL = { source: 1, sink: 12, edges: EVAC_EDGES_BASELINE };

const NET_EVAC_BLOCKED = {
  source: 1, sink: 12,
  edges: EVAC_EDGES_BASELINE.map(e =>
    (e.id === '5-7') ? { ...e, capacity: 0 } : { ...e }
  )
};

const NET_EVAC_RESTRICTED = {
  source: 1, sink: 12,
  edges: EVAC_EDGES_BASELINE.map(e =>
    (e.id === '10-12') ? { ...e, capacity: 4 } : { ...e }
  )
};

// ---------------------------------------------------------------------------
// Test Cases
// ---------------------------------------------------------------------------

console.log('================================================================');
console.log('  FLOW SOLVERS (Phase 6 Metrics & Traces) — COMPREHENSIVE TEST SUITE  ');
console.log('================================================================');

// TC-01 ─ Single edge
runTest('TC-01 Single edge graph (S→T, cap 7)', () => {
  assertAllSolversAgree(NET_SINGLE_EDGE, 7, 'TC-01');
});

// TC-02 ─ Two independent parallel paths
runTest('TC-02 Two independent paths (EK=FF=WP=10)', () => {
  assertAllSolversAgree(NET_TWO_PATHS, 10, 'TC-02');
});

// TC-03 ─ Shared bottleneck diamond
runTest('TC-03 Diamond / shared bottleneck (max flow = 14)', () => {
  assertAllSolversAgree(NET_DIAMOND, 14, 'TC-03');
});

// TC-04 ─ Residual-edge rerouting
runTest('TC-04 Residual-edge rerouting required (max flow = 20)', () => {
  assertAllSolversAgree(NET_REROUTE, 20, 'TC-04');
});

// TC-05 ─ Disconnected graph (flow = 0)
runTest('TC-05 Disconnected graph — all solvers return maxFlow = 0', () => {
  const ek = solveEdmondsKarp(NET_DISCONNECTED);
  const ff = solveFordFulkerson(NET_DISCONNECTED);
  const wp = solveWidestPath(NET_DISCONNECTED);
  assert.strictEqual(ek.maxFlow, 0, 'EK: disconnected graph must have maxFlow=0');
  assert.strictEqual(ff.maxFlow, 0, 'FF: disconnected graph must have maxFlow=0');
  assert.strictEqual(wp.maxFlow, 0, 'WP: disconnected graph must have maxFlow=0');
  assert.strictEqual(ek.cutCapacity, 0, 'EK: disconnected graph cutCapacity must be 0');
});

// TC-06 ─ Zero-capacity edges (filtered; valid S→T remains)
runTest('TC-06 Zero-capacity edges filtered (max flow = 4)', () => {
  assertAllSolversAgree(NET_ZERO_CAP, 4, 'TC-06');
});

// TC-07 ─ Self-loop edges ignored in residual search
runTest('TC-07 Self-loop edge ignored in residual (max flow = 6)', () => {
  assertAllSolversAgree(NET_SELFLOOP, 6, 'TC-07');
});

// TC-08 ─ Classic CLRS 6-node textbook graph
runTest('TC-08 Classic CLRS 6-node graph (max flow = 23)', () => {
  assertAllSolversAgree(NET_CLRS, 23, 'TC-08');
});

// TC-09 ─ Evacuation Scenario 1: Normal Operation
runTest('TC-09 Scenario 1: Normal Operation (expected 23 people/min)', () => {
  assertAllSolversAgree(NET_EVAC_NORMAL, 23, 'TC-09 Normal');
});

// TC-10 ─ Evacuation Scenario 2: Blocked Staircase A (edge 5→7 cap → 0)
runTest('TC-10 Scenario 2: Blocked Staircase A (expected 13 people/min)', () => {
  assertAllSolversAgree(NET_EVAC_BLOCKED, 13, 'TC-10 Blocked Staircase A');
});

// TC-11 ─ Evacuation Scenario 3: Restricted North Exit (edge 10→12 cap → 4)
runTest('TC-11 Scenario 3: Restricted North Exit (expected 14 people/min)', () => {
  assertAllSolversAgree(NET_EVAC_RESTRICTED, 14, 'TC-11 Restricted North Exit');
});

// TC-12 ─ verifySolverResult 9-invariant check (positive case)
runTest('TC-12 verifySolverResult — all 9 invariants pass for valid result', () => {
  const result = solveEdmondsKarp(NET_CLRS);
  assert.strictEqual(result.isCorrect, true, 'isCorrect must be true');
  assert.deepStrictEqual(result.verifierErrors, [], 'verifierErrors must be empty');
  const v = verifySolverResult(NET_CLRS, result);
  assert.strictEqual(v.isCorrect, true, 'verifySolverResult must confirm correctness');
  assert.deepStrictEqual(v.errors, [], 'verifier must return no errors');
  // Check that all 9 named checks passed
  assert.ok(v.checks.CHECK_1_CAPACITY_CONSTRAINTS.passed, 'Check 1 passed');
  assert.ok(v.checks.CHECK_2_FLOW_CONSERVATION.passed, 'Check 2 passed');
  assert.ok(v.checks.CHECK_3_NET_TERMINAL_FLOW.passed, 'Check 3 passed');
  assert.ok(v.checks.CHECK_4_INDEPENDENT_RESIDUAL_REACHABILITY.passed, 'Check 4 passed');
  assert.ok(v.checks.CHECK_5_SINK_UNREACHABLE.passed, 'Check 5 passed');
  assert.ok(v.checks.CHECK_6_CUT_PARTITION.passed, 'Check 6 passed');
  assert.ok(v.checks.CHECK_7_CUT_EDGES_AND_CAPACITY.passed, 'Check 7 passed');
  assert.ok(v.checks.CHECK_8_MAX_FLOW_MIN_CUT_EQUALITY.passed, 'Check 8 passed');
  assert.ok(v.checks.CHECK_9_AUGMENTING_PATHS_VALIDITY.passed, 'Check 9 passed');
});

// TC-13 ─ Error result for invalid networkDef
runTest('TC-13 Invalid networkDef (missing source) — returns ERROR status', () => {
  const badNet = { sink: 'T', edges: [{ id: 'e1', source: 'A', target: 'T', capacity: 5 }] };
  const ek = solveEdmondsKarp(badNet);
  const ff = solveFordFulkerson(badNet);
  const wp = solveWidestPath(badNet);
  assert.strictEqual(ek.status, 'ERROR', 'EK must return ERROR for missing source');
  assert.strictEqual(ff.status, 'ERROR', 'FF must return ERROR for missing source');
  assert.strictEqual(wp.status, 'ERROR', 'WP must return ERROR for missing source');
  assert.ok(ek.errorMessage && ek.errorMessage.length > 0, 'errorMessage must be non-empty');
});

// TC-14 ─ Parallel original edges with distinct IDs
runTest('TC-14 Parallel original edges with distinct IDs (S->A: 5 + 7, A->T: 12)', () => {
  const netParallel = {
    source: 'S', sink: 'T',
    edges: [
      { id: 'p1', source: 'S', target: 'A', capacity: 5 },
      { id: 'p2', source: 'S', target: 'A', capacity: 7 },
      { id: 'p3', source: 'A', target: 'T', capacity: 12 }
    ]
  };
  const oracle = exhaustiveMinCutOracle(netParallel);
  assert.strictEqual(oracle.minCutCapacity, 12, 'Oracle min-cut capacity must be 12');

  assertAllSolversAgree(netParallel, 12, 'TC-14 Parallel Edges');

  const res = solveEdmondsKarp(netParallel);
  const flowMap = new Map(res.edgeFlows.map(e => [e.id, e.flow]));
  assert.strictEqual(flowMap.get('p1'), 5, 'Parallel edge p1 must be saturated at 5');
  assert.strictEqual(flowMap.get('p2'), 7, 'Parallel edge p2 must be saturated at 7');
  assert.strictEqual(flowMap.get('p3'), 12, 'Edge p3 must carry 12');
});

// TC-15 ─ Bidirectional original edges between same vertex pair
runTest('TC-15 Bidirectional edges between same vertex pair (A->B and B->A)', () => {
  const netBidir = {
    source: 'S', sink: 'T',
    edges: [
      { id: 'e_sa', source: 'S', target: 'A', capacity: 10 },
      { id: 'e_sb', source: 'S', target: 'B', capacity: 5  },
      { id: 'e_ab', source: 'A', target: 'B', capacity: 6  },
      { id: 'e_ba', source: 'B', target: 'A', capacity: 4  },
      { id: 'e_at', source: 'A', target: 'T', capacity: 8  },
      { id: 'e_bt', source: 'B', target: 'T', capacity: 7  }
    ]
  };
  const oracle = exhaustiveMinCutOracle(netBidir);
  assertAllSolversAgree(netBidir, oracle.minCutCapacity, 'TC-15 Bidirectional Edges');

  const res = solveEdmondsKarp(netBidir);
  assert.strictEqual(res.maxFlow, oracle.minCutCapacity, 'Max flow matches oracle');
  for (const ef of res.edgeFlows) {
    assert.ok(ef.flow >= 0 && ef.flow <= ef.capacity,
      `Edge ${ef.id} flow (${ef.flow}) must be within [0, ${ef.capacity}]`);
  }
});

// TC-16 ─ Combination of parallel edges and residual reverse-edge rerouting
runTest('TC-16 Parallel edges combined with residual reverse-edge rerouting', () => {
  const netMultiReroute = {
    source: 'S', sink: 'T',
    edges: [
      { id: 'e_sa1', source: 'S', target: 'A', capacity: 4 },
      { id: 'e_sa2', source: 'S', target: 'A', capacity: 6 },
      { id: 'e_sb',  source: 'S', target: 'B', capacity: 10 },
      { id: 'e_ab',  source: 'A', target: 'B', capacity: 2  },
      { id: 'e_at',  source: 'A', target: 'T', capacity: 10 },
      { id: 'e_bt',  source: 'B', target: 'T', capacity: 10 }
    ]
  };
  const oracle = exhaustiveMinCutOracle(netMultiReroute);
  assert.strictEqual(oracle.minCutCapacity, 20, 'Oracle min-cut capacity must be 20');
  assertAllSolversAgree(netMultiReroute, 20, 'TC-16 Parallel + Rerouting');
});

// TC-17 ─ Zero-capacity edges and self-loops output preservation
runTest('TC-17 Zero-capacity edges and self-loops preserved with zero flow', () => {
  const netWithSelfLoops = {
    source: 'S', sink: 'T',
    edges: [
      { id: 'self_s', source: 'S', target: 'S', capacity: 5 },
      { id: 'self_a', source: 'A', target: 'A', capacity: 10 },
      { id: 'e_sa',   source: 'S', target: 'A', capacity: 6 },
      { id: 'e_at',   source: 'A', target: 'T', capacity: 6 },
      { id: 'e_zero', source: 'S', target: 'B', capacity: 0 },
      { id: 'e_bt',   source: 'B', target: 'T', capacity: 8 }
    ]
  };
  const res = solveEdmondsKarp(netWithSelfLoops);
  assertOptimal(res, 6, 'TC-17 Self-loops');
  assert.strictEqual(res.edgeFlows.length, 6, 'All 6 original edges must be preserved');
  const flowMap = new Map(res.edgeFlows.map(e => [e.id, e.flow]));
  assert.strictEqual(flowMap.get('self_s'), 0, 'Self-loop self_s must have flow 0');
  assert.strictEqual(flowMap.get('self_a'), 0, 'Self-loop self_a must have flow 0');
  assert.strictEqual(flowMap.get('e_zero'), 0, 'Zero-capacity edge e_zero must have flow 0');
  assert.strictEqual(flowMap.get('e_sa'), 6, 'Edge e_sa must carry 6');
  assert.strictEqual(flowMap.get('e_at'), 6, 'Edge e_at must carry 6');
});

// TC-18 ─ Independent exhaustive cut-enumeration oracle comparison (6-node multi-graph)
runTest('TC-18 Exhaustive cut-enumeration oracle comparison on 6-node multi-graph', () => {
  const netMulti = {
    source: 'S', sink: 'T',
    edges: [
      { id: 'e1', source: 'S',  target: 'N1', capacity: 8 },
      { id: 'e2', source: 'S',  target: 'N2', capacity: 7 },
      { id: 'e3', source: 'N1', target: 'N3', capacity: 4 },
      { id: 'e4', source: 'N1', target: 'N2', capacity: 2 },
      { id: 'e5', source: 'N2', target: 'N3', capacity: 3 },
      { id: 'e6', source: 'N2', target: 'N4', capacity: 5 },
      { id: 'e7', source: 'N3', target: 'T',  capacity: 6 },
      { id: 'e8', source: 'N4', target: 'T',  capacity: 7 }
    ]
  };
  const oracle = exhaustiveMinCutOracle(netMulti);
  const ek = solveEdmondsKarp(netMulti);
  const ff = solveFordFulkerson(netMulti);
  const wp = solveWidestPath(netMulti);

  assert.strictEqual(ek.maxFlow, oracle.minCutCapacity, 'EK maxFlow equals oracle minCutCapacity');
  assert.strictEqual(ff.maxFlow, oracle.minCutCapacity, 'FF maxFlow equals oracle minCutCapacity');
  assert.strictEqual(wp.maxFlow, oracle.minCutCapacity, 'WP maxFlow equals oracle minCutCapacity');
  assert.strictEqual(ek.cutCapacity, oracle.minCutCapacity, 'EK cutCapacity equals oracle minCutCapacity');
  assert.strictEqual(ff.cutCapacity, oracle.minCutCapacity, 'FF cutCapacity equals oracle minCutCapacity');
  assert.strictEqual(wp.cutCapacity, oracle.minCutCapacity, 'WP cutCapacity equals oracle minCutCapacity');
});

// TC-19 ─ Malformed inputs rejection (all return status: ERROR)
runTest('TC-19 Malformed inputs rejection suite (missing terminals, endpoints, neg/NaN cap, dup IDs)', () => {
  const malformedCases = [
    { label: 'missing source', def: { sink: 'T', edges: [{ id: 'e1', source: 'S', target: 'T', capacity: 5 }] } },
    { label: 'missing sink',   def: { source: 'S', edges: [{ id: 'e1', source: 'S', target: 'T', capacity: 5 }] } },
    { label: 'source == sink', def: { source: 'S', sink: 'S', edges: [{ id: 'e1', source: 'S', target: 'T', capacity: 5 }] } },
    { label: 'missing edge endpoint', def: { source: 'S', sink: 'T', edges: [{ id: 'e1', source: 'S', capacity: 5 }] } },
    { label: 'negative capacity',     def: { source: 'S', sink: 'T', edges: [{ id: 'e1', source: 'S', target: 'T', capacity: -3 }] } },
    { label: 'NaN capacity',          def: { source: 'S', sink: 'T', edges: [{ id: 'e1', source: 'S', target: 'T', capacity: NaN }] } },
    { label: 'duplicate edge IDs',    def: { source: 'S', sink: 'T', edges: [
      { id: 'dup_id', source: 'S', target: 'A', capacity: 3 },
      { id: 'dup_id', source: 'A', target: 'T', capacity: 3 }
    ] } }
  ];

  for (const mc of malformedCases) {
    const ek = solveEdmondsKarp(mc.def);
    const ff = solveFordFulkerson(mc.def);
    const wp = solveWidestPath(mc.def);
    assert.strictEqual(ek.status, 'ERROR', `EK must reject ${mc.label}`);
    assert.strictEqual(ff.status, 'ERROR', `FF must reject ${mc.label}`);
    assert.strictEqual(wp.status, 'ERROR', `WP must reject ${mc.label}`);
    assert.ok(ek.errorMessage && ek.errorMessage.length > 0, `EK errorMessage required for ${mc.label}`);
  }
});

// TC-20 ─ Floating-point / non-integer capacities (tolerance handling)
runTest('TC-20 Floating-point / non-integer capacities (tolerance handling)', () => {
  const netFloat = {
    source: 'S', sink: 'T',
    edges: [
      { id: 'e1', source: 'S', target: 'A', capacity: 2.5  },
      { id: 'e2', source: 'S', target: 'B', capacity: 3.75 },
      { id: 'e3', source: 'A', target: 'B', capacity: 1.0  },
      { id: 'e4', source: 'A', target: 'T', capacity: 1.5  },
      { id: 'e5', source: 'B', target: 'T', capacity: 4.25 }
    ]
  };
  const oracle = exhaustiveMinCutOracle(netFloat);
  assertAllSolversAgree(netFloat, oracle.minCutCapacity, 'TC-20 Floating-Point Capacities');
});

// TC-21 ─ Verifier failure detection (negative tests for verifySolverResult)
runTest('TC-21 Verifier failure detection on tampered / invalid solutions', () => {
  const baseResult = solveEdmondsKarp(NET_CLRS);
  assert.strictEqual(baseResult.isCorrect, true, 'Base solution must be correct');

  // Negative Check 1: Capacity constraint violation
  const badCapResult = JSON.parse(JSON.stringify(baseResult));
  badCapResult.edgeFlows[0].flow = badCapResult.edgeFlows[0].capacity + 10;
  const v1 = verifySolverResult(NET_CLRS, badCapResult);
  assert.strictEqual(v1.isCorrect, false, 'Verifier must fail when flow exceeds capacity');
  assert.strictEqual(v1.checks.CHECK_1_CAPACITY_CONSTRAINTS.passed, false, 'Check 1 must be flagged');

  // Negative Check 2: Conservation violation at intermediate vertex
  const badConservResult = JSON.parse(JSON.stringify(baseResult));
  const v1Edge = badConservResult.edgeFlows.find(e => e.target === 'v1');
  if (v1Edge) v1Edge.flow += 5;
  const v2 = verifySolverResult(NET_CLRS, badConservResult);
  assert.strictEqual(v2.isCorrect, false, 'Verifier must fail when conservation is violated');
  assert.strictEqual(v2.checks.CHECK_2_FLOW_CONSERVATION.passed, false, 'Check 2 must be flagged');

  // Negative Check 3: Net terminal flow mismatch
  const badNetFlowResult = JSON.parse(JSON.stringify(baseResult));
  badNetFlowResult.maxFlow += 5;
  const v3 = verifySolverResult(NET_CLRS, badNetFlowResult);
  assert.strictEqual(v3.isCorrect, false, 'Verifier must fail when reported maxFlow mismatches net flow');
  assert.strictEqual(v3.checks.CHECK_3_NET_TERMINAL_FLOW.passed, false, 'Check 3 must be flagged');

  // Negative Check 5: Sink still reachable in residual graph
  const incompleteResult = JSON.parse(JSON.stringify(baseResult));
  // Reduce flows so an augmenting path remains
  for (const ef of incompleteResult.edgeFlows) ef.flow = 0;
  incompleteResult.maxFlow = 0;
  incompleteResult.cutCapacity = 0;
  const v5 = verifySolverResult(NET_CLRS, incompleteResult);
  assert.strictEqual(v5.isCorrect, false, 'Verifier must fail when sink is still reachable in residual graph');
  assert.strictEqual(v5.checks.CHECK_5_SINK_UNREACHABLE.passed, false, 'Check 5 must be flagged');
});

// TC-22 ─ Phase 6: Standardized metrics completeness & non-negativity across all solvers
runTest('TC-22 Standardized metrics completeness & non-negativity across all solvers', () => {
  const solvers = [
    { name: 'EK', fn: solveEdmondsKarp },
    { name: 'FF', fn: solveFordFulkerson },
    { name: 'WP', fn: solveWidestPath }
  ];

  for (const s of solvers) {
    const res = s.fn(NET_CLRS);
    const m = res.metrics;
    assert.ok(m, `${s.name}: metrics object must be present`);
    assert.strictEqual(typeof m.augmentations, 'number', `${s.name}: augmentations must be a number`);
    assert.ok(m.augmentations > 0, `${s.name}: augmentations must be positive`);
    assert.strictEqual(m.augmentations, res.augmentingPaths.length, `${s.name}: augmentations must match augmentingPaths length`);
    assert.strictEqual(typeof m.searchAttempts, 'number', `${s.name}: searchAttempts must be a number`);
    assert.ok(m.searchAttempts >= m.augmentations, `${s.name}: searchAttempts >= augmentations`);
    assert.strictEqual(typeof m.edgeExaminations, 'number', `${s.name}: edgeExaminations must be a number`);
    assert.ok(m.edgeExaminations > 0, `${s.name}: edgeExaminations must be positive`);
    assert.strictEqual(typeof m.elapsedMs, 'number', `${s.name}: elapsedMs must be a number`);
    assert.ok(m.elapsedMs >= 0, `${s.name}: elapsedMs >= 0`);
    assert.strictEqual(typeof m.initMs, 'number', `${s.name}: initMs must be a number`);
    assert.ok(m.initMs >= 0, `${s.name}: initMs >= 0`);
    assert.strictEqual(typeof m.coreMs, 'number', `${s.name}: coreMs must be a number`);
    assert.ok(m.coreMs >= 0, `${s.name}: coreMs >= 0`);
    assert.strictEqual(typeof m.totalMs, 'number', `${s.name}: totalMs must be a number`);
    assert.ok(m.totalMs >= 0, `${s.name}: totalMs >= 0`);
    assert.strictEqual(m.isTerminated, true, `${s.name}: isTerminated must be true`);
    assert.strictEqual(m.terminationReason, 'NO_AUGMENTING_PATH', `${s.name}: terminationReason must be NO_AUGMENTING_PATH`);
    assert.strictEqual(m.elapsedMs, m.totalMs, `${s.name}: elapsedMs alias must equal totalMs`);
    assert.strictEqual(res.durationMs, m.totalMs, `${s.name}: durationMs must equal totalMs`);
  }
});

// TC-23 ─ Phase 6: Search attempts counting (k+1 optimality proof, disconnected, error)
runTest('TC-23 Search attempts counting (k+1 optimality proof, disconnected, error)', () => {
  // Case A: Single edge (1 augmentation, 1 final unsuccessful search = 2 search attempts)
  const ekSingle = solveEdmondsKarp(NET_SINGLE_EDGE);
  assert.strictEqual(ekSingle.metrics.augmentations, 1, 'Single edge: exactly 1 augmentation');
  assert.strictEqual(ekSingle.metrics.searchAttempts, 2, 'Single edge: exactly 2 search attempts (1 success + 1 proof of optimality)');

  const ffSingle = solveFordFulkerson(NET_SINGLE_EDGE);
  assert.strictEqual(ffSingle.metrics.augmentations, 1, 'FF single edge: 1 augmentation');
  assert.strictEqual(ffSingle.metrics.searchAttempts, 2, 'FF single edge: 2 search attempts');

  const wpSingle = solveWidestPath(NET_SINGLE_EDGE);
  assert.strictEqual(wpSingle.metrics.augmentations, 1, 'WP single edge: 1 augmentation');
  assert.strictEqual(wpSingle.metrics.searchAttempts, 2, 'WP single edge: 2 search attempts');

  // Case B: Disconnected graph (0 augmentations, 1 unsuccessful search attempt)
  const ekDisc = solveEdmondsKarp(NET_DISCONNECTED);
  assert.strictEqual(ekDisc.metrics.augmentations, 0, 'Disconnected: 0 augmentations');
  assert.strictEqual(ekDisc.metrics.searchAttempts, 1, 'Disconnected: exactly 1 search attempt');

  // Case C: CLRS graph (searchAttempts === augmentations + 1 for normal termination)
  const ekClrs = solveEdmondsKarp(NET_CLRS);
  assert.strictEqual(ekClrs.metrics.searchAttempts, ekClrs.metrics.augmentations + 1,
    'EK CLRS: searchAttempts must equal augmentations + 1');
  const ffClrs = solveFordFulkerson(NET_CLRS);
  assert.strictEqual(ffClrs.metrics.searchAttempts, ffClrs.metrics.augmentations + 1,
    'FF CLRS: searchAttempts must equal augmentations + 1');
  const wpClrs = solveWidestPath(NET_CLRS);
  assert.strictEqual(wpClrs.metrics.searchAttempts, wpClrs.metrics.augmentations + 1,
    'WP CLRS: searchAttempts must equal augmentations + 1');

  // Case D: Error network (missing source)
  const errRes = solveEdmondsKarp({ sink: 'T', edges: [] });
  assert.strictEqual(errRes.metrics.augmentations, 0, 'Error: 0 augmentations');
  assert.strictEqual(errRes.metrics.searchAttempts, 0, 'Error: 0 search attempts');
});

// TC-24 ─ Phase 6: Edge examinations counting convention consistency
runTest('TC-24 Edge examinations counting convention consistency', () => {
  // On NET_SINGLE_EDGE (S->T, cap 7):
  // Search 1: examines S->T (remCap 7 > 0), finds T. (1 examination)
  // Search 2: examines S->T (remCap 0 <= 1e-9), no node pushed, queue ends. (1 examination)
  // Total edgeExaminations for BFS = 2
  const ek = solveEdmondsKarp(NET_SINGLE_EDGE);
  assert.strictEqual(ek.metrics.edgeExaminations, 2,
    'EK single edge: exactly 2 edge examinations (1 active + 1 saturated)');

  // On NET_CLRS, all solvers examine a non-trivial number of edges
  const ff = solveFordFulkerson(NET_CLRS);
  const wp = solveWidestPath(NET_CLRS);
  assert.ok(ek.metrics.edgeExaminations >= ek.metrics.searchAttempts, 'EK examinations >= attempts');
  assert.ok(ff.metrics.edgeExaminations >= ff.metrics.searchAttempts, 'FF examinations >= attempts');
  assert.ok(wp.metrics.edgeExaminations >= wp.metrics.searchAttempts, 'WP examinations >= attempts');
});

// TC-25 ─ Phase 6: Step-level execution trace connectivity and residual transitions
runTest('TC-25 Step-level execution trace connectivity and residual transitions', () => {
  const res = solveEdmondsKarp(NET_DIAMOND);
  assert.ok(res.augmentingPaths.length > 0, 'Augmenting paths must exist');

  for (const ap of res.augmentingPaths) {
    assert.ok(Array.isArray(ap.steps), 'ap.steps must be an array');
    assert.ok(ap.steps.length >= 1, 'ap.steps must have at least 1 step');

    // Source and sink endpoints
    assert.strictEqual(ap.steps[0].fromNode, 'S', 'First step must depart source S');
    assert.strictEqual(ap.steps[ap.steps.length - 1].toNode, 'T', 'Last step must arrive at sink T');

    // Contiguous path connectivity
    for (let s = 1; s < ap.steps.length; s++) {
      assert.strictEqual(ap.steps[s].fromNode, ap.steps[s - 1].toNode,
        `Step ${s} fromNode (${ap.steps[s].fromNode}) must match step ${s-1} toNode (${ap.steps[s-1].toNode})`);
    }

    // Residual capacity transitions
    let minResCap = Infinity;
    for (const step of ap.steps) {
      assert.ok(step.edgeId, 'step.edgeId must be non-null');
      assert.ok(typeof step.residualCapBefore === 'number', 'residualCapBefore is a number');
      assert.ok(typeof step.residualCapAfter === 'number', 'residualCapAfter is a number');
      assert.ok(step.residualCapBefore >= ap.bottleneck - 1e-9,
        `residualCapBefore (${step.residualCapBefore}) >= bottleneck (${ap.bottleneck})`);
      assert.ok(Math.abs(step.residualCapAfter - (step.residualCapBefore - ap.bottleneck)) < 1e-9,
        'residualCapAfter must equal residualCapBefore - bottleneck');
      if (step.residualCapBefore < minResCap) minResCap = step.residualCapBefore;
    }

    // Path bottleneck matches minimum residual capacity along the steps
    assert.ok(Math.abs(minResCap - ap.bottleneck) < 1e-9,
      `Path bottleneck (${ap.bottleneck}) must equal min residualCapBefore (${minResCap})`);

    // Saturated step exists
    const hasSaturatedStep = ap.steps.some(st => Math.abs(st.residualCapAfter) < 1e-9);
    assert.ok(hasSaturatedStep, 'At least one step in the augmenting path must become saturated');
  }
});

// TC-26 ─ Phase 6: Reverse-edge rerouting / flow cancellation explicit step trace
runTest('TC-26 Reverse-edge rerouting / flow cancellation explicit step trace', () => {
  // In NET_REROUTE, S->A(10), S->B(10), A->B(1), A->T(10), B->T(10).
  // If first path pushes flow through A->B (cap 1), then a subsequent path
  // CANCEL/REROUTES that flow via B->A (the reverse edge of A->B).
  // We run Ford-Fulkerson which traverses DFS (S->A->B->T bottleneck 1, then rerouting path).
  const ff = solveFordFulkerson(NET_REROUTE);
  assert.strictEqual(ff.maxFlow, 20, 'Max flow must be 20');

  let foundReverseStep = false;
  let reverseStepDetails = null;

  for (const ap of ff.augmentingPaths) {
    for (const step of ap.steps) {
      if (step.isReverse === true) {
        foundReverseStep = true;
        reverseStepDetails = step;
        assert.strictEqual(step.direction, 'REVERSE_CANCELLATION',
          'Reverse edge step must have direction REVERSE_CANCELLATION');
        assert.strictEqual(step.edgeId, 'e3', 'Reverse edge step must reference original edge e3 (A->B)');
        assert.strictEqual(step.fromNode, 'B', 'Reverse edge cancellation traverses B->A');
        assert.strictEqual(step.toNode, 'A', 'Reverse edge cancellation arrives at A');
      }
    }
  }

  assert.ok(foundReverseStep,
    'Trace must explicitly record a step with isReverse: true and direction: REVERSE_CANCELLATION during rerouting');
  assert.ok(reverseStepDetails.residualCapBefore > 0, 'Cancellation residual capacity must be > 0');
});

// TC-27 ─ Phase 6: Max iterations safety cap and INCOMPLETE status handling
runTest('TC-27 Max iterations safety cap and INCOMPLETE status handling', () => {
  // NET_TWO_PATHS requires 2 augmentations (S->A->T: 4, S->B->T: 6)
  const cappedRes = solveEdmondsKarp(NET_TWO_PATHS, { maxIterations: 1 });
  assert.strictEqual(cappedRes.status, 'INCOMPLETE', 'Status must be INCOMPLETE when capped');
  assert.strictEqual(cappedRes.terminationReason, 'MAX_ITERATIONS', 'terminationReason must be MAX_ITERATIONS');
  assert.strictEqual(cappedRes.metrics.isTerminated, true, 'isTerminated must be true');
  assert.strictEqual(cappedRes.metrics.terminationReason, 'MAX_ITERATIONS', 'metrics terminationReason must match');
  assert.strictEqual(cappedRes.metrics.augmentations, 1, 'Only 1 augmentation performed');
  assert.strictEqual(cappedRes.metrics.searchAttempts, 1, 'Only 1 search attempt performed');
  assert.ok(cappedRes.maxFlow < 10, `Flow (${cappedRes.maxFlow}) must be strictly less than full maxFlow (10)`);
});

// TC-28 ─ Phase 6: Verifier failure detection on tampered step traces
runTest('TC-28 Verifier failure detection on tampered step traces', () => {
  const baseResult = solveEdmondsKarp(NET_DIAMOND);
  assert.strictEqual(baseResult.isCorrect, true, 'Base result must be correct');

  // Negative Check: Disconnected step in trace
  const badStepsResult = JSON.parse(JSON.stringify(baseResult));
  if (badStepsResult.augmentingPaths[0].steps.length >= 2) {
    badStepsResult.augmentingPaths[0].steps[1].fromNode = 'NON_EXISTENT';
    const v = verifySolverResult(NET_DIAMOND, badStepsResult);
    assert.strictEqual(v.isCorrect, false, 'Verifier must fail when a step is disconnected');
    assert.strictEqual(v.checks.CHECK_9_AUGMENTING_PATHS_VALIDITY.passed, false, 'CHECK_9 must fail');
  }

  // Negative Check: Step residual capacity before < bottleneck
  const badCapBeforeResult = JSON.parse(JSON.stringify(baseResult));
  badCapBeforeResult.augmentingPaths[0].steps[0].residualCapBefore = 0.0001; // less than bottleneck
  const vCap = verifySolverResult(NET_DIAMOND, badCapBeforeResult);
  assert.strictEqual(vCap.isCorrect, false, 'Verifier must fail when step residual capacity < bottleneck');
  assert.strictEqual(vCap.checks.CHECK_9_AUGMENTING_PATHS_VALIDITY.passed, false, 'CHECK_9 must fail');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('================================================================');
console.log(`  TEST RESULTS: ${passedCount} passed, ${failedCount} failed out of ${testCount} tests`);
console.log('================================================================\n');

if (failedCount > 0) {
  console.error(`FAILED: ${failedCount} test(s) did not pass.\n`);
  process.exit(1);
} else {
  console.log('SUCCESS: All flow solver tests passed.\n');
  process.exit(0);
}
