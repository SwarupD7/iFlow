// ============================================================================
// BENCHMARK RUNNER — Phase 7 Empirical Benchmarking
// Application: Campus Evacuation Capacity Analyzer
// File: benchmarks/run-benchmarks.js
//
// CLI Usage:
//   node benchmarks/run-benchmarks.js              (quick profile)
//   node benchmarks/run-benchmarks.js --full        (full profile)
//   node benchmarks/run-benchmarks.js --quick       (explicit quick)
//
// Quick profile: 3 warm-up, 5 measured repetitions, smaller graphs
// Full profile:  3 warm-up, 30 measured repetitions, larger graphs
//
// Outputs:
//   benchmarks/results/raw-results.csv       — one row per (config × algo × rep)
//   benchmarks/results/summary-results.csv   — aggregated stats per config × algo
//   Console summary table
// ============================================================================

const path = require('path');
const fs   = require('fs');

// Import project modules
const solvers    = require(path.join(__dirname, '..', 'js', 'model', 'flow-solvers.js'));
const generators = require(path.join(__dirname, 'graph-generators.js'));
const utils      = require(path.join(__dirname, 'benchmark-utils.js'));

// Portable high-res timer
let _now;
try {
  const perfHooks = require('perf_hooks');
  _now = () => perfHooks.performance.now();
} catch (_e) {
  _now = () => Date.now();
}

// ---------------------------------------------------------------------------
// Parse CLI arguments
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const isFullProfile = args.includes('--full');
const profileName   = isFullProfile ? 'FULL' : 'QUICK';

const WARMUP_RUNS   = 3;
const MEASURED_RUNS = isFullProfile ? 30 : 5;
const TIMEOUT_MS    = isFullProfile ? 60000 : 15000;

// ---------------------------------------------------------------------------
// Solver registry
// ---------------------------------------------------------------------------
const SOLVERS = [
  { name: 'Edmonds-Karp', fn: solvers.solveEdmondsKarp },
  { name: 'Ford-Fulkerson', fn: solvers.solveFordFulkerson },
  { name: 'Widest-Path', fn: solvers.solveWidestPath }
];

// ---------------------------------------------------------------------------
// Benchmark configurations
// ---------------------------------------------------------------------------
function buildConfigs() {
  const configs = [];

  // --- Known-answer campus evacuation scenarios ---
  const evacEdgesBaseline = [
    { id: '1-2',   source: '1',  target: '2',  capacity: 10 },
    { id: '1-3',   source: '1',  target: '3',  capacity: 8  },
    { id: '1-4',   source: '1',  target: '4',  capacity: 7  },
    { id: '2-5',   source: '2',  target: '5',  capacity: 8  },
    { id: '3-5',   source: '3',  target: '5',  capacity: 5  },
    { id: '3-6',   source: '3',  target: '6',  capacity: 4  },
    { id: '4-6',   source: '4',  target: '6',  capacity: 7  },
    { id: '5-7',   source: '5',  target: '7',  capacity: 10 },
    { id: '5-8',   source: '5',  target: '8',  capacity: 4  },
    { id: '6-8',   source: '6',  target: '8',  capacity: 3  },
    { id: '6-9',   source: '6',  target: '9',  capacity: 8  },
    { id: '7-10',  source: '7',  target: '10', capacity: 10 },
    { id: '8-10',  source: '8',  target: '10', capacity: 3  },
    { id: '8-11',  source: '8',  target: '11', capacity: 3  },
    { id: '9-11',  source: '9',  target: '11', capacity: 7  },
    { id: '10-12', source: '10', target: '12', capacity: 13 },
    { id: '11-12', source: '11', target: '12', capacity: 10 }
  ];

  configs.push({
    name: 'Evacuation-Normal',
    family: 'evacuation',
    networkDef: { source: '1', sink: '12', edges: evacEdgesBaseline.map(e => ({ ...e })) },
    expectedMaxFlow: 23,
    vertices: 12,
    edgeCount: 17
  });

  configs.push({
    name: 'Evacuation-Blocked',
    family: 'evacuation',
    networkDef: {
      source: '1', sink: '12',
      edges: evacEdgesBaseline.map(e => (e.id === '5-7' ? { ...e, capacity: 0 } : { ...e }))
    },
    expectedMaxFlow: 13,
    vertices: 12,
    edgeCount: 17
  });

  configs.push({
    name: 'Evacuation-Restricted',
    family: 'evacuation',
    networkDef: {
      source: '1', sink: '12',
      edges: evacEdgesBaseline.map(e => (e.id === '10-12' ? { ...e, capacity: 4 } : { ...e }))
    },
    expectedMaxFlow: 14,
    vertices: 12,
    edgeCount: 17
  });

  // --- Sparse graph scaling ---
  const sparseSizes = isFullProfile ? [10, 25, 50, 100, 200, 400] : [10, 25, 50, 100];
  for (const n of sparseSizes) {
    const net = generators.generateSparse(n, 42);
    configs.push({
      name: `Sparse-${n}V`,
      family: 'sparse',
      networkDef: net,
      expectedMaxFlow: null,
      vertices: n,
      edgeCount: net.edges.length
    });
  }

  // --- Dense graph scaling ---
  const denseSizes = isFullProfile ? [10, 15, 25, 35, 50] : [10, 15, 25];
  for (const n of denseSizes) {
    const net = generators.generateDense(n, 42);
    configs.push({
      name: `Dense-${n}V`,
      family: 'dense',
      networkDef: net,
      expectedMaxFlow: null,
      vertices: n,
      edgeCount: net.edges.length
    });
  }

  // --- Grid graph scaling ---
  const gridSizes = isFullProfile
    ? [[3,3],[4,4],[5,5],[7,7],[10,10]]
    : [[3,3],[4,4],[5,5],[7,7]];
  for (const [r, c] of gridSizes) {
    const net = generators.generateGrid(r, c, 42);
    configs.push({
      name: `Grid-${r}x${c}`,
      family: 'grid',
      networkDef: net,
      expectedMaxFlow: null,
      vertices: r * c,
      edgeCount: net.edges.length
    });
  }

  // --- Layered graph scaling ---
  const layeredSizes = isFullProfile
    ? [[3,4],[4,6],[5,8],[6,10],[8,12]]
    : [[3,4],[4,6],[5,8]];
  for (const [layers, npl] of layeredSizes) {
    const net = generators.generateLayered(layers, npl, 42);
    configs.push({
      name: `Layered-${layers}L${npl}N`,
      family: 'layered',
      networkDef: net,
      expectedMaxFlow: null,
      vertices: net.meta.vertices,
      edgeCount: net.edges.length
    });
  }

  // --- Capacity range experiments (fixed 25-node sparse structure) ---
  const capRanges = [[1,10],[1,100],[1,1000],[1,10000]];
  for (const cr of capRanges) {
    const net = generators.generateSparse(25, 42, cr);
    configs.push({
      name: `CapRange-${cr[0]}-${cr[1]}`,
      family: 'capacity',
      networkDef: net,
      expectedMaxFlow: null,
      vertices: 25,
      edgeCount: net.edges.length
    });
  }

  return configs;
}

// ---------------------------------------------------------------------------
// Run a single benchmark configuration
// ---------------------------------------------------------------------------
function runConfig(config) {
  const results = [];

  for (let si = 0; si < SOLVERS.length; si++) {
    const solver = SOLVERS[si];

    // Rotate algorithm execution order per config to reduce ordering bias
    const solverIdx = (si + configs.indexOf(config)) % SOLVERS.length;
    const actualSolver = SOLVERS[solverIdx];

    // Warm-up runs (not measured)
    for (let w = 0; w < WARMUP_RUNS; w++) {
      const fresh = generators.cloneNetworkDef(config.networkDef);
      try {
        actualSolver.fn(fresh);
      } catch (_e) { /* ignore warm-up errors */ }
    }

    // Measured runs
    for (let rep = 0; rep < MEASURED_RUNS; rep++) {
      const fresh = generators.cloneNetworkDef(config.networkDef);

      const t0 = _now();
      let result = null;
      let error = null;
      let timedOut = false;

      try {
        result = actualSolver.fn(fresh);
      } catch (e) {
        error = e.message || String(e);
      }

      const elapsed = _now() - t0;

      if (elapsed > TIMEOUT_MS) {
        timedOut = true;
      }

      const row = {
        config: config.name,
        family: config.family,
        algorithm: actualSolver.name,
        vertices: config.vertices,
        edgeCount: config.edgeCount,
        repetition: rep + 1,
        maxFlow: result ? result.maxFlow : NaN,
        status: timedOut ? 'TIMEOUT' : (error ? 'ERROR' : (result ? result.status : 'ERROR')),
        isCorrect: result ? result.isCorrect : false,
        totalMs: result ? result.metrics.totalMs : elapsed,
        initMs: result ? result.metrics.initMs : NaN,
        coreMs: result ? result.metrics.coreMs : NaN,
        augmentations: result ? result.metrics.augmentations : NaN,
        searchAttempts: result ? result.metrics.searchAttempts : NaN,
        edgeExaminations: result ? result.metrics.edgeExaminations : NaN,
        terminationReason: result ? result.terminationReason : (error || 'ERROR'),
        errorMessage: error || ''
      };

      // Validate against expected max flow if known
      if (config.expectedMaxFlow != null && result && result.status === 'OPTIMAL') {
        if (Math.abs(result.maxFlow - config.expectedMaxFlow) > 1e-9) {
          row.status = 'INCORRECT';
          row.errorMessage = `Expected maxFlow ${config.expectedMaxFlow}, got ${result.maxFlow}`;
        }
      }

      results.push(row);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// CSV output helpers
// ---------------------------------------------------------------------------
const RAW_HEADER = [
  'config', 'family', 'algorithm', 'vertices', 'edgeCount', 'repetition',
  'maxFlow', 'status', 'isCorrect',
  'totalMs', 'initMs', 'coreMs',
  'augmentations', 'searchAttempts', 'edgeExaminations',
  'terminationReason', 'errorMessage'
];

function rawRowToCSV(row) {
  return RAW_HEADER.map(h => utils.csvEscape(row[h] != null ? row[h] : '')).join(',');
}

// ---------------------------------------------------------------------------
// Main execution
// ---------------------------------------------------------------------------
console.log('================================================================');
console.log('  CAMPUS EVACUATION CAPACITY ANALYZER — BENCHMARK RUNNER');
console.log(`  Profile: ${profileName} | Warm-up: ${WARMUP_RUNS} | Measured: ${MEASURED_RUNS}`);
console.log(`  Timeout per run: ${TIMEOUT_MS}ms`);
console.log('================================================================\n');

const configs = buildConfigs();
console.log(`Benchmark configurations: ${configs.length}`);
console.log(`Algorithms: ${SOLVERS.map(s => s.name).join(', ')}`);
console.log(`Total planned runs: ${configs.length * SOLVERS.length * MEASURED_RUNS} (+ ${configs.length * SOLVERS.length * WARMUP_RUNS} warm-up)\n`);

const allRawResults = [];
const startTime = _now();

for (let ci = 0; ci < configs.length; ci++) {
  const config = configs[ci];
  const pct = Math.round(((ci + 1) / configs.length) * 100);
  process.stdout.write(`[${pct}%] Running: ${config.name} (V=${config.vertices}, E=${config.edgeCount}) ... `);

  const configStart = _now();
  const results = runConfig(config);
  const configElapsed = _now() - configStart;

  allRawResults.push(...results);

  const optimalCount = results.filter(r => r.status === 'OPTIMAL').length;
  const errorCount = results.filter(r => r.status !== 'OPTIMAL').length;
  console.log(`done (${utils.fmt(configElapsed, 1)}ms, ${optimalCount} OPTIMAL, ${errorCount} errors)`);
}

const totalElapsed = _now() - startTime;
console.log(`\nAll configurations complete in ${utils.fmt(totalElapsed / 1000, 2)}s\n`);

// ---------------------------------------------------------------------------
// Write raw CSV
// ---------------------------------------------------------------------------
const resultsDir = path.join(__dirname, 'results');
if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

const rawCSVPath = path.join(resultsDir, 'raw-results.csv');
const rawCSV = RAW_HEADER.map(utils.csvEscape).join(',') + '\n' +
               allRawResults.map(rawRowToCSV).join('\n') + '\n';
fs.writeFileSync(rawCSVPath, rawCSV, 'utf8');
console.log(`Raw results written to:     ${rawCSVPath}`);

// ---------------------------------------------------------------------------
// Aggregate and write summary CSV
// ---------------------------------------------------------------------------
const groupByFields = ['config', 'family', 'algorithm', 'vertices', 'edgeCount'];
const metricFields  = ['totalMs', 'initMs', 'coreMs', 'augmentations', 'searchAttempts', 'edgeExaminations'];

// Filter to OPTIMAL results for summary statistics
const optimalResults = allRawResults.filter(r => r.status === 'OPTIMAL');

const summaries = utils.aggregateResults(optimalResults, groupByFields, metricFields);

// Build summary CSV header
const summaryMetricCols = [];
for (const mf of metricFields) {
  for (const stat of ['median', 'mean', 'min', 'max', 'iqr', 'stddev', 'cv']) {
    summaryMetricCols.push(mf + '_' + stat);
  }
}
const SUMMARY_HEADER = [...groupByFields, 'repetitions', ...summaryMetricCols];

const summaryRows = summaries.map(s =>
  SUMMARY_HEADER.map(h => {
    const val = s[h];
    if (typeof val === 'number') return utils.fmt(val, 6);
    return val != null ? String(val) : '';
  })
);

const summaryCSVPath = path.join(resultsDir, 'summary-results.csv');
const summaryCSV = utils.buildCSV(SUMMARY_HEADER, summaryRows);
fs.writeFileSync(summaryCSVPath, summaryCSV, 'utf8');
console.log(`Summary results written to: ${summaryCSVPath}`);

// ---------------------------------------------------------------------------
// Console summary table
// ---------------------------------------------------------------------------
console.log('\n================================================================');
console.log('  BENCHMARK SUMMARY TABLE');
console.log('================================================================');
console.log(
  'Config'.padEnd(24) +
  'Algorithm'.padEnd(22) +
  'V'.padStart(5) +
  'E'.padStart(7) +
  'MaxFlow'.padStart(10) +
  'Med ms'.padStart(12) +
  'Aug'.padStart(6) +
  'Search'.padStart(8) +
  'EdgeExam'.padStart(10) +
  'Status'
);
console.log('-'.repeat(104));

for (const s of summaries) {
  // Find a representative maxFlow from raw results
  const sample = allRawResults.find(r => r.config === s.config && r.algorithm === s.algorithm && r.status === 'OPTIMAL');
  const mf = sample ? sample.maxFlow : 'N/A';

  console.log(
    String(s.config).padEnd(24) +
    String(s.algorithm).padEnd(22) +
    String(s.vertices).padStart(5) +
    String(s.edgeCount).padStart(7) +
    String(mf).padStart(10) +
    utils.fmt(s.totalMs_median, 3).padStart(12) +
    utils.fmt(s.augmentations_median, 0).padStart(6) +
    utils.fmt(s.searchAttempts_median, 0).padStart(8) +
    utils.fmt(s.edgeExaminations_median, 0).padStart(10) +
    '  OK'
  );
}

console.log('-'.repeat(104));

// ---------------------------------------------------------------------------
// Error / anomaly report
// ---------------------------------------------------------------------------
const nonOptimal = allRawResults.filter(r => r.status !== 'OPTIMAL');
if (nonOptimal.length > 0) {
  console.log(`\nWARNING: ${nonOptimal.length} non-OPTIMAL results detected:`);
  for (const r of nonOptimal.slice(0, 10)) {
    console.log(`  ${r.config} | ${r.algorithm} | rep ${r.repetition}: ${r.status} — ${r.errorMessage}`);
  }
  if (nonOptimal.length > 10) {
    console.log(`  ... and ${nonOptimal.length - 10} more`);
  }
} else {
  console.log('\nAll results have OPTIMAL status. No anomalies detected.');
}

// ---------------------------------------------------------------------------
// Consistency check: all solvers agree on maxFlow per config
// ---------------------------------------------------------------------------
console.log('\n--- Max-Flow Consistency Check ---');
let consistencyOK = true;
for (const config of configs) {
  const maxFlows = new Set();
  for (const r of allRawResults) {
    if (r.config === config.name && r.status === 'OPTIMAL') {
      maxFlows.add(r.maxFlow);
    }
  }
  if (maxFlows.size > 1) {
    console.log(`  INCONSISTENCY in ${config.name}: maxFlows = [${Array.from(maxFlows).join(', ')}]`);
    consistencyOK = false;
  }
}
if (consistencyOK) {
  console.log('  All solvers agree on maxFlow for every configuration. ✔');
}

// ---------------------------------------------------------------------------
// Platform info
// ---------------------------------------------------------------------------
console.log('\n--- Platform ---');
console.log(`Node.js: ${process.version}`);
console.log(`OS: ${process.platform} ${process.arch}`);
console.log(`Date: ${new Date().toISOString()}`);
console.log(`Profile: ${profileName}`);

console.log('\n================================================================');
console.log('  BENCHMARK RUN COMPLETE');
console.log('================================================================');
