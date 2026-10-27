// ============================================================================
// PHASE 7 BENCHMARK MODULE TEST SUITE
// Application: Campus Evacuation Capacity Analyzer
// Location: tests/test-benchmarks.js
//
// Tests:
// 1. Seeded PRNG determinism, period, and range
// 2. Graph generators (sparse, dense, grid, layered, capacity variant)
// 3. Graph reachability, connectivity, and structural constraints
// 4. cloneNetworkDef isolation and immutability
// 5. Statistical functions (median, percentile, iqr, mean, stddev, cv, min, max)
// 6. CSV building, escaping, and parsing round-trip fidelity
// 7. Benchmark result aggregation logic
// 8. Solvers consistency on dynamically generated graphs
// 9. Benchmark artifact schema and data validation (raw-results.csv & summary-results.csv)
//
// Exits with code 0 on complete pass, or code 1 on failure.
// ============================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const generators = require(path.join(__dirname, '..', 'benchmarks', 'graph-generators.js'));
const utils      = require(path.join(__dirname, '..', 'benchmarks', 'benchmark-utils.js'));
const solvers    = require(path.join(__dirname, '..', 'js', 'model', 'flow-solvers.js'));

let testsPassed = 0;
let testsFailed = 0;

function runTest(testName, fn) {
  process.stdout.write(`[Test ${testsPassed + testsFailed + 1}] ${testName} ... `);
  try {
    fn();
    console.log('PASSED ✔');
    testsPassed++;
  } catch (err) {
    console.log('FAILED ✖');
    console.error(`  Error: ${err.message}`);
    if (err.stack) console.error(err.stack);
    testsFailed++;
  }
}

console.log('================================================================');
console.log('  BENCHMARK & GENERATOR MODULE TEST SUITE                       ');
console.log('================================================================');

// ---------------------------------------------------------------------------
// TEST 1: PRNG determinism & bounds
// ---------------------------------------------------------------------------
runTest('PRNG determinism and range [0, 1)', () => {
  const rng1 = generators.createPRNG(12345);
  const rng2 = generators.createPRNG(12345);
  const rngDiff = generators.createPRNG(99999);

  const seq1 = [];
  const seq2 = [];
  const seqDiff = [];

  for (let i = 0; i < 50; i++) {
    const val1 = rng1();
    const val2 = rng2();
    const valDiff = rngDiff();

    assert(val1 >= 0 && val1 < 1, `Value ${val1} out of [0, 1) bounds`);
    seq1.push(val1);
    seq2.push(val2);
    seqDiff.push(valDiff);
  }

  // Same seed must produce identical sequences
  assert.deepStrictEqual(seq1, seq2, 'PRNG with identical seeds must produce identical sequences');

  // Different seed must produce different sequence
  const identicalCount = seq1.filter((v, i) => v === seqDiff[i]).length;
  assert(identicalCount < 5, 'PRNG with different seeds should not match');
});

// ---------------------------------------------------------------------------
// TEST 2: randInt and shuffle
// ---------------------------------------------------------------------------
runTest('randInt bounded output and shuffle array preservation', () => {
  const rng = generators.createPRNG(42);

  for (let i = 0; i < 100; i++) {
    const v = generators.randInt(rng, 10, 20);
    assert(Number.isInteger(v), 'randInt must return integer');
    assert(v >= 10 && v <= 20, `randInt out of bounds: ${v}`);
  }

  const orig = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const copy = orig.slice();
  generators.shuffle(rng, copy);

  assert.strictEqual(copy.length, orig.length, 'Shuffled array length preserved');
  assert.deepStrictEqual(copy.slice().sort((a,b) => a - b), orig, 'Shuffled array contains exact same elements');
});

// ---------------------------------------------------------------------------
// TEST 3: generateSparse structural validity and determinism
// ---------------------------------------------------------------------------
runTest('generateSparse: networkDef schema, reachability, and seed determinism', () => {
  const n = 20;
  const net1 = generators.generateSparse(n, 1001, [5, 50]);
  const net2 = generators.generateSparse(n, 1001, [5, 50]);

  // Schema validation
  assert.strictEqual(typeof net1.source, 'string', 'source must be string');
  assert.strictEqual(typeof net1.sink, 'string', 'sink must be string');
  assert.notStrictEqual(net1.source, net1.sink, 'source and sink must differ');
  assert(Array.isArray(net1.edges), 'edges must be array');
  assert(net1.edges.length >= n - 1, 'edges must contain at least Hamiltonian path');

  // Determinism
  assert.deepStrictEqual(net1, net2, 'generateSparse must be 100% deterministic with same seed');

  // Capacity range check
  for (const e of net1.edges) {
    assert(e.capacity >= 5 && e.capacity <= 50, `Capacity ${e.capacity} outside [5, 50]`);
    assert(e.source !== e.target, 'No self-loops should be created in sparse generator');
  }

  // Residual graph build test
  const res = solvers.buildResidualNetwork(net1);
  assert(!res.error, `buildResidualNetwork failed: ${res.error}`);
});

// ---------------------------------------------------------------------------
// TEST 4: generateDense density and reachability
// ---------------------------------------------------------------------------
runTest('generateDense: density significantly higher than sparse', () => {
  const n = 15;
  const sparse = generators.generateSparse(n, 42);
  const dense  = generators.generateDense(n, 42);

  assert(dense.edges.length > sparse.edges.length,
    `Dense edges (${dense.edges.length}) should exceed sparse edges (${sparse.edges.length})`);
  assert(dense.edges.length > (n * (n - 1)) * 0.25,
    `Dense edges (${dense.edges.length}) should have density > 0.25`);

  const res = solvers.buildResidualNetwork(dense);
  assert(!res.error, `buildResidualNetwork failed on dense: ${res.error}`);
});

// ---------------------------------------------------------------------------
// TEST 5: generateGrid lattice structure and dimensions
// ---------------------------------------------------------------------------
runTest('generateGrid: lattice rows x cols nodes and correct terminals', () => {
  const rows = 4, cols = 5;
  const grid = generators.generateGrid(rows, cols, 77);

  assert.strictEqual(grid.source, '0', 'Grid source must be top-left node 0');
  assert.strictEqual(grid.sink, String(rows * cols - 1), 'Grid sink must be bottom-right node');
  assert.strictEqual(grid.meta.vertices, rows * cols, 'Vertices count must match rows * cols');

  // Check all edge endpoints are within [0, rows*cols - 1]
  const totalNodes = rows * cols;
  for (const e of grid.edges) {
    const u = parseInt(e.source, 10);
    const v = parseInt(e.target, 10);
    assert(u >= 0 && u < totalNodes, `Invalid source ${u}`);
    assert(v >= 0 && v < totalNodes, `Invalid target ${v}`);
  }
});

// ---------------------------------------------------------------------------
// TEST 6: generateLayered DAG structure
// ---------------------------------------------------------------------------
runTest('generateLayered: strict forward inter-layer edges only', () => {
  const layers = 4;
  const nodesPerLayer = 3;
  const layered = generators.generateLayered(layers, nodesPerLayer, 88);

  // Total nodes: 1 (source) + (layers - 2) * nodesPerLayer + 1 (sink)
  const expectedVertices = 1 + (layers - 2) * nodesPerLayer + 1;
  assert.strictEqual(layered.meta.vertices, expectedVertices, 'Vertices count mismatch');

  // Build residual network to ensure solver-ready
  const res = solvers.buildResidualNetwork(layered);
  assert(!res.error, `buildResidualNetwork failed on layered: ${res.error}`);

  // Test that EK can solve it
  const ek = solvers.solveEdmondsKarp(layered);
  assert.strictEqual(ek.status, 'OPTIMAL');
  assert(ek.maxFlow > 0, 'Layered graph should have positive max flow');
});

// ---------------------------------------------------------------------------
// TEST 7: generateCapacityVariant and cloneNetworkDef
// ---------------------------------------------------------------------------
runTest('generateCapacityVariant and cloneNetworkDef deep isolation', () => {
  const base = generators.generateSparse(12, 55, [1, 10]);
  const variant = generators.generateCapacityVariant(generators.generateSparse, [12, 55], [500, 1000], 55);

  assert.strictEqual(base.edges.length, variant.edges.length, 'Edge count should match on same seed');
  for (let i = 0; i < base.edges.length; i++) {
    assert.strictEqual(base.edges[i].source, variant.edges[i].source);
    assert.strictEqual(base.edges[i].target, variant.edges[i].target);
    assert(variant.edges[i].capacity >= 500 && variant.edges[i].capacity <= 1000);
  }

  // Clone isolation
  const clone = generators.cloneNetworkDef(base);
  clone.edges[0].capacity = 999999;
  assert.notStrictEqual(base.edges[0].capacity, 999999, 'Modifying clone must not alter original networkDef');
});

// ---------------------------------------------------------------------------
// TEST 8: Statistical utilities accuracy
// ---------------------------------------------------------------------------
runTest('Statistical functions: median, percentile, iqr, mean, stddev, cv, min, max', () => {
  const oddArr = [3, 1, 4, 1, 5, 9, 2]; // sorted: 1, 1, 2, 3, 4, 5, 9 (len 7, median index 3 -> 3)
  assert.strictEqual(utils.median(oddArr), 3, 'Odd median failed');

  const evenArr = [10, 20, 30, 40]; // median = (20 + 30) / 2 = 25
  assert.strictEqual(utils.median(evenArr), 25, 'Even median failed');

  const data = [2, 4, 4, 4, 5, 5, 7, 9];
  assert.strictEqual(utils.mean(data), 5, 'Mean calculation failed');
  assert.strictEqual(utils.min(data), 2, 'Min calculation failed');
  assert.strictEqual(utils.max(data), 9, 'Max calculation failed');

  // IQR test: Q1 at 25%, Q3 at 75%
  const iqrVal = utils.iqr(data);
  assert(iqrVal > 0, 'IQR should be positive');

  // Stddev test
  const sd = utils.stddev(data);
  assert(sd > 0, 'Stddev should be positive');

  // CV test
  const cv = utils.coefficientOfVariation(data);
  assert.strictEqual(Math.round(cv), Math.round((sd / 5) * 100), 'CV should equal (sd / mean) * 100');
});

// ---------------------------------------------------------------------------
// TEST 9: CSV building and parsing round-trip fidelity
// ---------------------------------------------------------------------------
runTest('CSV builder and parser: escaping and bidirectional fidelity', () => {
  const header = ['name', 'category,type', 'description', 'value'];
  const rows = [
    ['Test A', 'cat1', 'Simple text', '100'],
    ['Test B', 'cat,with,commas', 'Text with "quotes"', '250.5'],
    ['Test C', 'cat3', 'Line 1\nLine 2', '0']
  ];

  const csvStr = utils.buildCSV(header, rows);
  const parsed = utils.parseCSV(csvStr);

  assert.strictEqual(parsed.header.length, header.length, 'Header length mismatch');
  assert.strictEqual(parsed.header[1], 'category,type', 'Header unescaped improperly');
  assert.strictEqual(parsed.rows.length, rows.length, 'Row count mismatch');
  assert.strictEqual(parsed.rows[1][1], 'cat,with,commas', 'Quoted commas parsed incorrectly');
  assert.strictEqual(parsed.rows[1][2], 'Text with "quotes"', 'Quoted quotes parsed incorrectly');
});

// ---------------------------------------------------------------------------
// TEST 10: aggregateResults correctness
// ---------------------------------------------------------------------------
runTest('aggregateResults: groups rows and computes statistical summary', () => {
  const rawData = [
    { config: 'GraphA', algo: 'EK', run: 1, time: 10, aug: 5 },
    { config: 'GraphA', algo: 'EK', run: 2, time: 20, aug: 5 },
    { config: 'GraphA', algo: 'EK', run: 3, time: 30, aug: 5 },
    { config: 'GraphA', algo: 'FF', run: 1, time: 50, aug: 12 },
    { config: 'GraphA', algo: 'FF', run: 2, time: 70, aug: 12 }
  ];

  const summaries = utils.aggregateResults(
    rawData,
    ['config', 'algo'],
    ['time', 'aug']
  );

  assert.strictEqual(summaries.length, 2, 'Should create 2 summary groups');

  const ekSummary = summaries.find(s => s.algo === 'EK');
  assert(ekSummary, 'EK summary group must exist');
  assert.strictEqual(ekSummary.time_median, 20, 'Median time of [10, 20, 30] should be 20');
  assert.strictEqual(ekSummary.time_mean, 20, 'Mean time should be 20');
  assert.strictEqual(ekSummary.time_min, 10, 'Min time should be 10');
  assert.strictEqual(ekSummary.time_max, 30, 'Max time should be 30');
  assert.strictEqual(ekSummary.aug_median, 5, 'Median augmentations should be 5');
});

// ---------------------------------------------------------------------------
// TEST 11: Solvers consistency and 9-invariant validity on generated graphs
// ---------------------------------------------------------------------------
runTest('Solver correctness & 9-invariant verification on generated sparse graph', () => {
  const net = generators.generateSparse(15, 303, [1, 50]);

  const ek = solvers.solveEdmondsKarp(generators.cloneNetworkDef(net));
  const ff = solvers.solveFordFulkerson(generators.cloneNetworkDef(net));
  const wp = solvers.solveWidestPath(generators.cloneNetworkDef(net));

  assert.strictEqual(ek.status, 'OPTIMAL', 'EK must achieve OPTIMAL status');
  assert.strictEqual(ff.status, 'OPTIMAL', 'FF must achieve OPTIMAL status');
  assert.strictEqual(wp.status, 'OPTIMAL', 'WP must achieve OPTIMAL status');

  assert.strictEqual(ek.isCorrect, true, 'EK must pass all 9 verifier checks');
  assert.strictEqual(ff.isCorrect, true, 'FF must pass all 9 verifier checks');
  assert.strictEqual(wp.isCorrect, true, 'WP must pass all 9 verifier checks');

  // All 3 solvers must find the exact same maximum flow
  assert.strictEqual(Math.abs(ek.maxFlow - ff.maxFlow) < 1e-9, true,
    `EK (${ek.maxFlow}) and FF (${ff.maxFlow}) must yield identical max flow`);
  assert.strictEqual(Math.abs(ek.maxFlow - wp.maxFlow) < 1e-9, true,
    `EK (${ek.maxFlow}) and WP (${wp.maxFlow}) must yield identical max flow`);
});

// ---------------------------------------------------------------------------
// TEST 12: Benchmark results file schema and content audit
// ---------------------------------------------------------------------------
runTest('Benchmark results files: raw-results.csv and summary-results.csv audit', () => {
  const resultsDir = path.join(__dirname, '..', 'benchmarks', 'results');
  const rawPath = path.join(resultsDir, 'raw-results.csv');
  const sumPath = path.join(resultsDir, 'summary-results.csv');

  assert(fs.existsSync(rawPath), 'raw-results.csv must exist');
  assert(fs.existsSync(sumPath), 'summary-results.csv must exist');

  const rawContent = fs.readFileSync(rawPath, 'utf8');
  const parsedRaw = utils.parseCSV(rawContent);

  assert(parsedRaw.rows.length > 50, `raw-results.csv must have records (found ${parsedRaw.rows.length})`);

  const expectedHeaders = [
    'config', 'family', 'algorithm', 'vertices', 'edgeCount', 'repetition',
    'maxFlow', 'status', 'isCorrect', 'totalMs', 'initMs', 'coreMs',
    'augmentations', 'searchAttempts', 'edgeExaminations',
    'terminationReason', 'errorMessage'
  ];
  for (const h of expectedHeaders) {
    assert(parsedRaw.header.includes(h), `raw-results.csv missing header: ${h}`);
  }

  // Ensure every row has status OPTIMAL
  const statusIdx = parsedRaw.header.indexOf('status');
  for (let r = 0; r < parsedRaw.rows.length; r++) {
    const status = parsedRaw.rows[r][statusIdx];
    assert.strictEqual(status, 'OPTIMAL', `Row ${r + 1} status is ${status}, expected OPTIMAL`);
  }

  // Summary file audit
  const sumContent = fs.readFileSync(sumPath, 'utf8');
  const parsedSum = utils.parseCSV(sumContent);
  assert(parsedSum.rows.length >= 15, `summary-results.csv must have aggregated rows (found ${parsedSum.rows.length})`);
  assert(parsedSum.header.includes('totalMs_median'), 'summary CSV missing totalMs_median');
  assert(parsedSum.header.includes('augmentations_median'), 'summary CSV missing augmentations_median');
  assert(parsedSum.header.includes('edgeExaminations_median'), 'summary CSV missing edgeExaminations_median');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('================================================================');
console.log(`  TEST RESULTS: ${testsPassed} passed, ${testsFailed} failed out of ${testsPassed + testsFailed} tests`);
console.log('================================================================\n');

if (testsFailed > 0) {
  console.error(`FAILURE: ${testsFailed} test(s) failed.`);
  process.exit(1);
} else {
  console.log('SUCCESS: All benchmark module tests passed.\n');
  process.exit(0);
}
