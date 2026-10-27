// ============================================================================
// DAA COURSE PROJECT — MASTER TEST RUNNER
// Application: Campus Evacuation Capacity Analyzer
// Location: tests/run-all-tests.js
//
// Automatically executes:
// 1. tests/test-flow-network.js (Algorithm & FlowNetwork test cases)
// 2. tests/test-scenarios-and-ui.js (Scenarios, comparison metrics, UI state machine)
//
// Exits with code 0 on complete pass, or code 1 if any test fails.
// ============================================================================

const { spawnSync } = require('child_process');
const path = require('path');

console.log('\n====================================================================');
console.log('   CAMPUS EVACUATION CAPACITY ANALYZER — MASTER TEST SUITE RUNNER   ');
console.log('   DAA Course Project — Verification & Correctness Audit            ');
console.log('====================================================================\n');

const testSuites = [
  {
    name: 'Algorithm & FlowNetwork Tests',
    file: path.join(__dirname, 'test-flow-network.js'),
    desc: 'Max-flow correctness, min-cut extraction, theorem verification, rerouting, malformed input'
  },
  {
    name: 'Scenarios & UI State Integration Tests',
    file: path.join(__dirname, 'test-scenarios-and-ui.js'),
    desc: 'Scenario switching, baseline comparisons, % formatting, layout preservation, practice mode lifecycle'
  },
  {
    name: 'Flow Solvers Module Tests (Phase 6 Metrics & Traces)',
    file: path.join(__dirname, 'test-flow-solvers.js'),
    desc: 'Edmonds-Karp, Ford-Fulkerson, Widest-Path solvers — 9-invariant verifier, brute-force cut oracle, metrics & execution trace verification'
  }
];

let totalPassedSuites = 0;
let totalFailedSuites = 0;
const startTime = Date.now();

for (const suite of testSuites) {
  console.log(`>>> RUNNING SUITE: ${suite.name}`);
  console.log(`    Scope: ${suite.desc}`);
  console.log('--------------------------------------------------------------------');

  const result = spawnSync(process.execPath, [suite.file], {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });

  if (result.status === 0) {
    totalPassedSuites++;
    console.log(`>>> SUITE PASSED: ${suite.name} ✔\n`);
  } else {
    totalFailedSuites++;
    console.log(`>>> SUITE FAILED: ${suite.name} (Exit code: ${result.status}) ✖\n`);
  }
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

console.log('====================================================================');
console.log('   OVERALL TEST EXECUTION SUMMARY                                   ');
console.log('====================================================================');
console.log(`Total Test Suites Executed : ${testSuites.length}`);
console.log(`Suites Passed              : ${totalPassedSuites} / ${testSuites.length}`);
console.log(`Suites Failed              : ${totalFailedSuites} / ${testSuites.length}`);
console.log(`Total Execution Time       : ${elapsed}s`);
console.log('====================================================================\n');

if (totalFailedSuites > 0) {
  console.error('FAILED: One or more test suites encountered failures.\n');
  process.exit(1);
} else {
  console.log('SUCCESS: All test suites passed completely with 100% assertions verified.\n');
  process.exit(0);
}
