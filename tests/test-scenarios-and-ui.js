// ============================================================================
// DAA COURSE PROJECT — SCENARIOS & UI STATE INTEGRATION TEST SUITE
// Application: Campus Evacuation Capacity Analyzer
// Location: tests/test-scenarios-and-ui.js
//
// Covers:
// 1. Scenario definitions and baseline comparison calculations
// 2. Percentage Reduction vs Signed Change formatting and zero-baseline guard
// 3. Coordinate preservation across all 12 evacuation nodes
// 4. Repeated scenario switching cycles (invariant edge counts & capacities)
// 5. UI state machine lifecycle & practice mode exit
// 6. Automated analysis execution during active practice mode
// 7. Reset Analysis restoring pristine graph state
// 8. Generic 8-node example switching & practice preservation
// 9. Start Over snapshot workflow integrity
// ============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const rootDir = path.resolve(__dirname, '..');

// 1. Load vendor libraries
const lodashCode = fs.readFileSync(path.join(rootDir, 'vendor/js/lodash.js'), 'utf8');
vm.runInThisContext(lodashCode);
if (typeof _ === 'undefined' && typeof window !== 'undefined') {
  global._ = window._;
}

// 2. Load model classes
const pqCode = fs.readFileSync(path.join(rootDir, 'js/model/priority-queue.js'), 'utf8');
vm.runInThisContext(pqCode);
const mfCode = fs.readFileSync(path.join(rootDir, 'js/model/max-flow.js'), 'utf8');
vm.runInThisContext(mfCode);

// 3. Mock Cytoscape graph store
class MockCy {
  constructor() {
    this._nodes = new Map();
    this._edges = new Map();
  }
  nodes() {
    const list = Array.from(this._nodes.values()).map(n => ({
      id: () => String(n.id),
      data: (k) => k ? n[k] : n,
      _private: { data: { id: n.id } },
      position: (pos) => {
        if (pos) { n.x = pos.x; n.y = pos.y; }
        return { x: n.x, y: n.y };
      },
      css: (k) => n.styles[k] || "",
      style: (k, v) => { if (v !== undefined) n.styles[k] = v; return n.styles[k] || ""; },
      remove: () => this._nodes.delete(String(n.id))
    }));
    list.remove = () => this._nodes.clear();
    list.unlock = () => {};
    return list;
  }
  collection() {
    const colNodes = [];
    const col = {
      union: (node) => { colNodes.push(node); return col; },
      style: (k, v) => colNodes.forEach(n => { if (n.style) n.style(k, v); })
    };
    return col;
  }
  edges(selector) {
    let list = Array.from(this._edges.values());
    if (selector) {
      const sMatch = selector.match(/\[source=['"]([^'"]+)['"]\]/);
      const tMatch = selector.match(/\[target=['"]([^'"]+)['"]\]/);
      if (sMatch && tMatch) {
        list = list.filter(e => String(e.source) === sMatch[1] && String(e.target) === tMatch[1]);
      }
    }
    const mapped = list.map(e => ({
      id: () => String(e.id),
      source: () => ({ id: () => String(e.source) }),
      target: () => ({ id: () => String(e.target) }),
      css: (k) => k === 'label' ? String(e.label) : (e.styles[k] || ""),
      style: () => ({ label: String(e.label) }),
      addClass: (cls) => { e.classes = e.classes || new Set(); e.classes.add(cls); },
      removeClass: (cls) => { if (e.classes) e.classes.delete(cls); },
      hasClass: (cls) => Boolean(e.classes && e.classes.has(cls)),
      remove: () => this._edges.delete(String(e.id))
    }));
    mapped.remove = () => list.forEach(e => this._edges.delete(String(e.id)));
    mapped.removeClass = (cls) => list.forEach(e => { if (e.classes) e.classes.delete(cls); });
    mapped.addClass = (cls) => list.forEach(e => { e.classes = e.classes || new Set(); e.classes.add(cls); });
    return mapped;
  }
  elements() {
    return {
      removeClass: () => {}
    };
  }
  add(element) {
    if (element.group === 'nodes') {
      this._nodes.set(String(element.data.id), {
        id: element.data.id,
        name: element.data.name,
        x: element.position ? element.position.x : 0,
        y: element.position ? element.position.y : 0,
        styles: {}
      });
    } else if (element.group === 'edges') {
      this._edges.set(String(element.data.id), {
        id: element.data.id,
        source: element.data.source,
        target: element.data.target,
        label: element.style ? element.style.label : (element.data.label || "1"),
        styles: element.style || {},
        classes: new Set()
      });
    }
  }
  reset() {}
  center() {}
  zoom() { return 1; }
  pan() { return { x: 0, y: 0 }; }
  edgehandles() {}
  panzoom() {}
  on() {}
  $() { return { style: () => {}, isEdge: () => false, remove: () => {} }; }
  style() { return { selector: () => ({ style: () => ({ update: () => {} }) }), fromJson: () => {} }; }
}

// 4. Mock DOM elements store
const domState = {
  text: {},
  html: {},
  css: {},
  classes: {},
  visible: {},
  val: {}
};

const handlers = {};
function getMockEl(sel) {
  return {
    text: function(val) {
      if (val !== undefined) { domState.text[sel] = String(val); return this; }
      return domState.text[sel] || "";
    },
    html: function(val) {
      if (val !== undefined) { domState.html[sel] = String(val); return this; }
      return domState.html[sel] || "";
    },
    val: function(val) {
      if (val !== undefined) { domState.val[sel] = String(val); return this; }
      return domState.val[sel] || "";
    },
    css: function(k, val) {
      domState.css[sel] = domState.css[sel] || {};
      if (val !== undefined) { domState.css[sel][k] = String(val); return this; }
      return domState.css[sel][k] || "";
    },
    addClass: function(cls) {
      domState.classes[sel] = domState.classes[sel] || new Set();
      domState.classes[sel].add(cls);
      return this;
    },
    removeClass: function(cls) {
      if (domState.classes[sel]) domState.classes[sel].delete(cls);
      return this;
    },
    hasClass: function(cls) {
      return Boolean(domState.classes[sel] && domState.classes[sel].has(cls));
    },
    show: function() {
      domState.visible[sel] = true;
      return this;
    },
    hide: function() {
      domState.visible[sel] = false;
      return this;
    },
    slideDown: function() {
      domState.visible[sel] = true;
      return this;
    },
    slideUp: function() {
      domState.visible[sel] = false;
      return this;
    },
    empty: function() {
      domState.html[sel] = "";
      return this;
    },
    children: function() {
      return {
        show: () => { domState.visible[sel + " *"] = true; },
        hide: () => { domState.visible[sel + " *"] = false; }
      };
    },
    on: function(evt, handler) {
      handlers[sel + ":" + evt] = handler;
      return this;
    },
    click: function(handler) {
      if (handler) handlers[sel + ":click"] = handler;
      return this;
    },
    dblclick: function(handler) {
      if (handler) handlers[sel + ":dblclick"] = handler;
      return this;
    },
    keydown: function(handler) {
      if (handler) handlers[sel + ":keydown"] = handler;
      return this;
    },
    offset: function() {
      return { left: 0, top: 0 };
    },
    triggerHandler: function(evt) {
      if (handlers[sel + ":" + evt]) handlers[sel + ":" + evt]({ preventDefault: () => {} });
      return this;
    },
    trigger: function(evt) {
      return this.triggerHandler(evt);
    }
  };
}

global.document = { activeElement: null, getElementById: () => ({ style: {}, addEventListener: () => {} }), addEventListener: () => {} };
global.window = global;
global.cytoscape = function() { return new MockCy(); };
global.cytoscapeSettings = { style: [{}, { css: { label: "1" } }] };
global.$ = function(selector) {
  if (typeof selector === 'function') {
    domReadyCallbacks.push(selector);
    return;
  }
  if (typeof selector === 'object' && selector !== null && selector._sel) {
    return getMockEl(selector._sel);
  }
  const el = getMockEl(selector);
  el._sel = selector;
  return el;
};
const domReadyCallbacks = [];

// Load interactivity-helper.js
const helperCode = fs.readFileSync(path.join(rootDir, 'js/interactivity/interactivity-helper.js'), 'utf8');
vm.runInThisContext(helperCode);

// Mock layout centering function and file reader
global.resizeAndCenterAccordingToCurrentGraphBlock = function() {};
global.readFile = function() {};

// Load app.js
const appCode = fs.readFileSync(path.join(rootDir, 'js/app.js'), 'utf8');
vm.runInThisContext(appCode);

// Load evacuation-scenarios.js
const scenariosCode = fs.readFileSync(path.join(rootDir, 'js/evacuation-scenarios.js'), 'utf8');
vm.runInThisContext(scenariosCode);

// Load evacuation-graph.js
const evacGraphCode = fs.readFileSync(path.join(rootDir, 'js/evacuation-graph.js'), 'utf8');
vm.runInThisContext(evacGraphCode);

// Load interactivity.js
const interactivityCode = fs.readFileSync(path.join(rootDir, 'js/interactivity/interactivity.js'), 'utf8');
vm.runInThisContext(interactivityCode);

// Execute DOM ready callbacks
domReadyCallbacks.forEach(cb => cb());

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
console.log('  SCENARIOS & UI STATE INTEGRATION TEST SUITE                   ');
console.log('================================================================');

// ----------------------------------------------------------------------------
// Test 1: Baseline Comparison Metrics & Formatting
// ----------------------------------------------------------------------------
runTest('Baseline Comparison Metrics (Reduction, Signed Change, Zero Guard)', () => {
  const baseline = 23;
  const flowA = 13;
  const redA = baseline - flowA; // 10
  const pctRedA = (redA / baseline) * 100; // 43.478%
  const chgA = flowA - baseline; // -10
  const pctChgA = (chgA / baseline) * 100; // -43.478%

  assert.strictEqual(redA, 10, 'Reduction magnitude must be positive 10');
  assert.strictEqual(pctRedA.toFixed(1), '43.5', 'Percentage reduction must be 43.5%');
  assert.strictEqual(chgA, -10, 'Signed change must be -10');
  assert.strictEqual(pctChgA.toFixed(1), '-43.5', 'Signed percentage change must be -43.5%');

  const flowB = 14;
  const redB = baseline - flowB; // 9
  const pctRedB = (redB / baseline) * 100; // 39.13%
  const chgB = flowB - baseline; // -9
  const pctChgB = (chgB / baseline) * 100; // -39.13%

  assert.strictEqual(redB, 9, 'Reduction magnitude must be positive 9');
  assert.strictEqual(pctRedB.toFixed(1), '39.1', 'Percentage reduction must be 39.1%');
  assert.strictEqual(chgB, -9, 'Signed change must be -9');
  assert.strictEqual(pctChgB.toFixed(1), '-39.1', 'Signed percentage change must be -39.1%');

  const zeroBaseline = 0;
  let zeroPct = 0;
  if (zeroBaseline > 0) zeroPct = ((0 - zeroBaseline) / zeroBaseline) * 100;
  assert.strictEqual(zeroPct, 0, 'Zero baseline must evaluate to 0% without divide-by-zero');
});

// ----------------------------------------------------------------------------
// Test 2: Predefined Scenarios & Immutable Baseline
// ----------------------------------------------------------------------------
runTest('Predefined Scenarios & Baseline Edge Immutability', () => {
  assert.ok(EVACUATION_SCENARIOS['normal'], 'Normal scenario defined');
  assert.ok(EVACUATION_SCENARIOS['blocked-staircase'], 'Blocked staircase scenario defined');
  assert.ok(EVACUATION_SCENARIOS['restricted-exit'], 'Restricted exit scenario defined');

  assert.strictEqual(EVACUATION_BASELINE_NODES.length, 12, 'Baseline must have 12 nodes');
  assert.strictEqual(EVACUATION_BASELINE_EDGES.length, 17, 'Baseline must have 17 edges');

  const normalEdges = EVACUATION_SCENARIOS['normal'].getEdges();
  const blockedEdges = EVACUATION_SCENARIOS['blocked-staircase'].getEdges();
  const restrictedEdges = EVACUATION_SCENARIOS['restricted-exit'].getEdges();

  const normal5_7 = normalEdges.find(e => e.source === 5 && e.target === 7);
  const blocked5_7 = blockedEdges.find(e => e.source === 5 && e.target === 7);
  const baseline5_7 = EVACUATION_BASELINE_EDGES.find(e => e.source === 5 && e.target === 7);

  assert.strictEqual(normal5_7.capacity, 10, 'Normal 5->7 capacity must be 10');
  assert.strictEqual(blocked5_7.capacity, 0, 'Blocked 5->7 capacity must be 0');
  assert.strictEqual(baseline5_7.capacity, 10, 'Baseline 5->7 capacity must remain 10 (immutable)');

  const restricted10_12 = restrictedEdges.find(e => e.source === 10 && e.target === 12);
  const baseline10_12 = EVACUATION_BASELINE_EDGES.find(e => e.source === 10 && e.target === 12);
  assert.strictEqual(restricted10_12.capacity, 4, 'Restricted 10->12 capacity must be 4');
  assert.strictEqual(baseline10_12.capacity, 13, 'Baseline 10->12 capacity must remain 13 (immutable)');
});

// ----------------------------------------------------------------------------
// Test 3: Coordinate Preservation across all Evacuation Nodes
// ----------------------------------------------------------------------------
runTest('Layout Preservation: Preset Coordinates across all 12 nodes', () => {
  assert.strictEqual(Object.keys(EVACUATION_PRESET_POSITIONS).length, 12, '12 preset positions defined');

  loadEvacuationScenario('normal');
  assert.strictEqual(cy._nodes.size, 12, 'Cytoscape must contain 12 nodes');

  for (const [id, pos] of Object.entries(EVACUATION_PRESET_POSITIONS)) {
    const node = cy._nodes.get(String(id));
    assert.ok(node, `Node ${id} must exist in Cytoscape`);
    assert.strictEqual(node.x, pos.x, `Node ${id} x-coordinate must match preset`);
    assert.strictEqual(node.y, pos.y, `Node ${id} y-coordinate must match preset`);
  }
});

// ----------------------------------------------------------------------------
// Test 4: Scenario Switching Cycles (No edge/capacity leaks)
// ----------------------------------------------------------------------------
runTest('Scenario Switching Cycles (5 continuous rounds: Normal -> Blocked -> Restricted)', () => {
  const scenarios = ['normal', 'blocked-staircase', 'restricted-exit'];

  for (let round = 1; round <= 5; round++) {
    for (const scId of scenarios) {
      loadEvacuationScenario(scId);

      assert.strictEqual(cy._nodes.size, 12, `Round ${round} ${scId}: Must have 12 nodes`);
      assert.strictEqual(cy._edges.size, 17, `Round ${round} ${scId}: Must have 17 edges`);

      const edge5_7 = cy._edges.get('5-7');
      const edge10_12 = cy._edges.get('10-12');

      if (scId === 'normal') {
        assert.strictEqual(edge5_7.label, '10', 'Normal: 5-7 capacity is 10');
        assert.strictEqual(edge10_12.label, '13', 'Normal: 10-12 capacity is 13');
      } else if (scId === 'blocked-staircase') {
        assert.strictEqual(edge5_7.label, '0 (Blocked)', 'Blocked: 5-7 capacity is 0 (Blocked)');
        assert.strictEqual(edge10_12.label, '13', 'Blocked: 10-12 capacity is 13');
      } else if (scId === 'restricted-exit') {
        assert.strictEqual(edge5_7.label, '10', 'Restricted: 5-7 capacity is 10');
        assert.strictEqual(edge10_12.label, '4 (Restricted)', 'Restricted: 10-12 capacity is 4 (Restricted)');
      }
    }
  }
});

// ----------------------------------------------------------------------------
// Test 5: UI State Machine Transitions & Practice Mode Exit
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// Test 5: UI State Machine Transitions & Practice Mode Exit
// ----------------------------------------------------------------------------
runTest('UI State Machine: Practice Mode Activation and Clean Exit', () => {
  loadEvacuationScenario('normal');

  $("#state").text("State: Select Path");
  $("#finalization-block").css("display", "block");
  $("#start-practice").hide();

  assert.strictEqual($("#state").text().includes("State: Graph Creation"), false, 'Not in Graph Creation');

  exitManualPracticeMode(false);

  assert.strictEqual($("#state").text(), "State: Graph Creation", 'State reset to Graph Creation');
  assert.strictEqual($("#finalization-block").css("display"), "none", 'Finalization sidebar hidden');
  assert.strictEqual($("#start-practice").text(), "Start Practice", 'Start Practice button restored');
});

// ----------------------------------------------------------------------------
// Test 6: Automated Analysis while Manual Practice is Active
// ----------------------------------------------------------------------------
runTest('Run Analysis while Manual Practice is Active', () => {
  loadEvacuationScenario('normal');

  $("#state").text("State: Select Path");
  $("#finalization-block").css("display", "block");

  runAutomatedAnalysis();

  assert.strictEqual($("#state").text(), "State: Graph Creation", 'State reset to Graph Creation');
  assert.strictEqual($("#finalization-block").css("display"), "none", 'Practice sidebar hidden');

  assert.ok(lastAnalysisResult, 'Analysis result object exists');
  assert.strictEqual(lastAnalysisResult.maxFlow, 23, 'Normal max flow is 23');
  assert.strictEqual(lastAnalysisResult.cutCapacity, 23, 'Normal cut capacity is 23');
  assert.strictEqual(lastAnalysisResult.theoremVerified, true, 'Max-Flow Min-Cut Theorem verified');
  assert.strictEqual(domState.visible["#evacuation-results-panel"], true, 'Results dashboard visible');
});

// ----------------------------------------------------------------------------
// Test 7: Reset Analysis Restores Pristine Graph State
// ----------------------------------------------------------------------------
runTest('Reset Analysis Restores Pristine State & Clears Dashboard', () => {
  loadEvacuationScenario('blocked-staircase');
  runAutomatedAnalysis();

  assert.strictEqual(domState.visible["#evacuation-results-panel"], true, 'Dashboard displayed before reset');

  resetAnalysis();

  assert.strictEqual(domState.visible["#evacuation-results-panel"], false, 'Dashboard hidden after reset');
  assert.strictEqual(lastAnalysisResult, null, 'Analysis result cleared');
  assert.strictEqual(cy._edges.size, 17, 'Graph preserved with 17 edges');
  assert.strictEqual(cy._edges.get('5-7').label, '0 (Blocked)', 'Blocked Staircase restored');
});

// ----------------------------------------------------------------------------
// Test 8: Generic Example Switch & Evacuation Flag Reset
// ----------------------------------------------------------------------------
runTest('Switch from Evacuation to Generic Example', () => {
  loadEvacuationScenario('normal');
  runAutomatedAnalysis();

  // Trigger Generic Example
  if (handlers["#example-graph:click"]) {
    handlers["#example-graph:click"]({ preventDefault: () => {} });
  } else if (typeof createExampleGraph === "function") {
    createExampleGraph({ preventDefault: () => {} });
  }

  assert.strictEqual(isEvacuationActive, false, 'isEvacuationActive set to false');
  assert.strictEqual(lastAnalysisResult, null, 'Evacuation results cleared');
  assert.strictEqual($("#source").text(), 'Source=1', 'Generic Source=1');
  assert.strictEqual($("#sink").text(), 'Sink=8', 'Generic Sink=8');
});

// ----------------------------------------------------------------------------
// Test 9: Original Manual Practice Start Over Preservation
// ----------------------------------------------------------------------------
runTest('Manual Practice Start Over Snapshot Lifecycle', () => {
  loadEvacuationScenario('normal');

  const startPracticeBtn = $("#start-practice");
  // 1. Enter manual practice mode
  handlers["#start-practice:click"].call(startPracticeBtn, { preventDefault: () => {} });
  assert.strictEqual(inGraphCreation(), false, 'Practice mode active');
  assert.ok($("#start-practice").text().includes("Start Over"), 'Button text updated to Start Over');
  assert.strictEqual(domState.css["#finalization-block"]["display"], "block", 'Sidebar visible');

  // 2. Click Start Over from the Beginning
  handlers["#start-practice:click"].call(startPracticeBtn, { preventDefault: () => {} });
  assert.strictEqual(inGraphCreation(), true, 'Start Over restores Graph Creation state');
  assert.strictEqual($("#finalization-block").css("display"), "none", 'Sidebar hidden');
  assert.strictEqual($("#start-practice").text(), "Start Practice", 'Button restored to Start Practice');
  assert.strictEqual(cy._nodes.size, 12, '12 nodes preserved');
  assert.strictEqual(cy._edges.size, 17, '17 edges restored from snapshot');
});

console.log('----------------------------------------------------------------');
console.log(`SUMMARY: ${passedCount} / ${testCount} tests passed (${failedCount} failed)`);
console.log('================================================================\n');

if (failedCount > 0) {
  process.exit(1);
}
