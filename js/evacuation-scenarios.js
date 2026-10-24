// ============================================================================
// CAMPUS EVACUATION SCENARIOS & AUTOMATED ANALYSIS MODULE
// DAA Course Project — Phase 2 Implementation
//
// Features:
// 1. Immutable Baseline Evacuation Graph Definition
// 2. Preset Coordinates for Layout Preservation (Rooms, Junctions, Staircases, Exits)
// 3. Three Predefined Scenarios (Normal, Blocked Staircase, Restricted Exit)
// 4. One-Click Automated Edmonds-Karp Maximum-Flow Analysis
// 5. Residual Graph S-Cut & Minimum-Cut Bottleneck Edge Detection
// 6. Comparative Dashboard Metrics (Throughput Reduction, Absolute Change, %)
// 7. Cytoscape Edge Highlighting for Minimum-Cut Bottlenecks
// 8. Reset Analysis & State Synchronization
// ============================================================================

// --- 1. IMMUTABLE BASELINE DEFINITION ---
const EVACUATION_PRESET_POSITIONS = {
  "1":  { x: 80,  y: 280 }, // Building Entrance (Source)
  "2":  { x: 250, y: 120 }, // Room 101
  "3":  { x: 250, y: 280 }, // Room 102
  "4":  { x: 250, y: 440 }, // Room 103
  "5":  { x: 420, y: 160 }, // Corridor Jn A
  "6":  { x: 420, y: 400 }, // Corridor Jn B
  "7":  { x: 570, y: 120 }, // Staircase A
  "8":  { x: 570, y: 280 }, // Main Corridor
  "9":  { x: 570, y: 440 }, // Staircase B
  "10": { x: 730, y: 160 }, // North Exit
  "11": { x: 730, y: 400 }, // South Exit
  "12": { x: 880, y: 280 }, // Safe Zone (Sink)
};

const EVACUATION_BASELINE_NODES = [
  { id: 1,  name: "Building Entrance" },
  { id: 2,  name: "Room 101" },
  { id: 3,  name: "Room 102" },
  { id: 4,  name: "Room 103" },
  { id: 5,  name: "Corridor Jn A" },
  { id: 6,  name: "Corridor Jn B" },
  { id: 7,  name: "Staircase A" },
  { id: 8,  name: "Main Corridor" },
  { id: 9,  name: "Staircase B" },
  { id: 10, name: "North Exit" },
  { id: 11, name: "South Exit" },
  { id: 12, name: "Safe Zone" },
];

const EVACUATION_BASELINE_EDGES = [
  // Source to Rooms
  { id: "1-2",  source: 1,  target: 2,  capacity: 10, label: "10" },
  { id: "1-3",  source: 1,  target: 3,  label: "8",  capacity: 8  },
  { id: "1-4",  source: 1,  target: 4,  label: "7",  capacity: 7  },
  // Rooms to Corridor Junctions
  { id: "2-5",  source: 2,  target: 5,  label: "8",  capacity: 8  },
  { id: "3-5",  source: 3,  target: 5,  label: "5",  capacity: 5  },
  { id: "3-6",  source: 3,  target: 6,  label: "4",  capacity: 4  },
  { id: "4-6",  source: 4,  target: 6,  label: "7",  capacity: 7  },
  // Junctions to Staircases / Main Corridor
  { id: "5-7",  source: 5,  target: 7,  label: "10", capacity: 10 },
  { id: "5-8",  source: 5,  target: 8,  label: "4",  capacity: 4  },
  { id: "6-8",  source: 6,  target: 8,  label: "3",  capacity: 3  },
  { id: "6-9",  source: 6,  target: 9,  label: "8",  capacity: 8  },
  // Staircases / Main Corridor to Exits
  { id: "7-10", source: 7,  target: 10, label: "10", capacity: 10 },
  { id: "8-10", source: 8,  target: 10, label: "3",  capacity: 3  },
  { id: "8-11", source: 8,  target: 11, label: "3",  capacity: 3  },
  { id: "9-11", source: 9,  target: 11, label: "7",  capacity: 7  },
  // Exits to Safe Zone (Sink)
  { id: "10-12", source: 10, target: 12, label: "13", capacity: 13 },
  { id: "11-12", source: 11, target: 12, label: "10", capacity: 10 },
];

// --- 2. SCENARIO DEFINITIONS ---
const EVACUATION_SCENARIOS = {
  "normal": {
    id: "normal",
    name: "Scenario 1: Normal Operation",
    badge: "Normal Operation",
    badgeClass: "label-primary",
    description: "Standard building operation. All staircases, corridors, and emergency exits are fully accessible at design capacities.",
    bottleneckExplanation: "Under normal operation, capacity is limited by the staircase-to-exit passages and central corridor feeds. Total throughput reaches the optimal design value.",
    getEdges: function () {
      // Returns a fresh clone of baseline edges
      return EVACUATION_BASELINE_EDGES.map(e => ({ ...e }));
    }
  },
  "blocked-staircase": {
    id: "blocked-staircase",
    name: "Scenario 2: Blocked Staircase A",
    badge: "Staircase A Blocked",
    badgeClass: "label-danger",
    description: "Emergency incident in Staircase A (Corridor Jn A → Staircase A). Staircase A is completely impassable (capacity = 0). Evacuation must divert via the Main Corridor and Staircase B.",
    bottleneckExplanation: "With Staircase A disabled, occupants from Room 101 and Junction A are throttled by the narrow Main Corridor (capacity 4). North Exit receives only 3 people/min from the corridor, cutting total evacuation throughput severely.",
    getEdges: function () {
      return EVACUATION_BASELINE_EDGES.map(e => {
        if (e.source === 5 && e.target === 7) {
          return { ...e, capacity: 0, label: "0 (Blocked)", isBlocked: true };
        }
        return { ...e };
      });
    }
  },
  "restricted-exit": {
    id: "restricted-exit",
    name: "Scenario 3: Restricted North Exit",
    badge: "North Exit Restricted",
    badgeClass: "label-warning",
    description: "Heavy smoke and debris near North Exit (North Exit → Safe Zone). Effective doorway capacity is throttled from 13 down to 4 people/minute.",
    bottleneckExplanation: "The constriction at North Exit creates an exit bottleneck. Despite Staircase A delivering up to 10 people/min, North Exit can only discharge 4 people/min into the Safe Zone, reducing overall building egress capacity.",
    getEdges: function () {
      return EVACUATION_BASELINE_EDGES.map(e => {
        if (e.source === 10 && e.target === 12) {
          return { ...e, capacity: 4, label: "4 (Restricted)", isRestricted: true };
        }
        return { ...e };
      });
    }
  }
};

// Global State for Scenarios and Analysis
var currentScenarioId = "normal";
var baselineMaxFlowValue = 23; // Canonical baseline value
var lastAnalysisResult = null;
var isEvacuationActive = false;

// --- 3. LAYOUT PRESERVATION HELPER ---
function restoreEvacuationLayout(cyInstance) {
  if (!cyInstance) return;
  cyInstance.nodes().forEach(node => {
    const id = String(node.id());
    if (EVACUATION_PRESET_POSITIONS[id]) {
      node.position({
        x: EVACUATION_PRESET_POSITIONS[id].x,
        y: EVACUATION_PRESET_POSITIONS[id].y
      });
    }
  });
  cyInstance.reset();
  cyInstance.center();
}

// --- 4. SCENARIO LOADER ---
function loadEvacuationScenario(scenarioId) {
  const scenario = EVACUATION_SCENARIOS[scenarioId] || EVACUATION_SCENARIOS["normal"];

  // 1. If manual practice mode is active, safely exit practice mode and reset state machine & controls
  if (typeof exitManualPracticeMode === "function") {
    exitManualPracticeMode(false);
  }

  // 2. Clear existing graph and selection
  if (typeof clearDrawboard === "function") {
    clearDrawboard();
  } else {
    cy.nodes().remove();
    cy.edges().remove();
  }

  currentScenarioId = scenario.id;
  isEvacuationActive = true;

  // Set Source and Sink
  source = "1";
  sink = "12";
  $("#source").text("Source=" + source);
  $("#sink").text("Sink=" + sink);

  // Add Nodes with preset positions and names
  EVACUATION_BASELINE_NODES.forEach(node => {
    const pos = EVACUATION_PRESET_POSITIONS[String(node.id)];
    addNode(cy, node.id, node.name, pos.x, pos.y);
  });

  // Add Edges with scenario-specific capacities
  const scenarioEdges = scenario.getEdges();
  scenarioEdges.forEach(edge => {
    const edgeId = edge.source + "-" + edge.target;
    addEdge(cy, edgeId, { label: edge.label }, edge.source, edge.target);

    // Visual indicators for blocked or restricted routes
    const cyEdge = cy.edges(`[source='${edge.source}'][target='${edge.target}']`);
    if (edge.isBlocked) {
      cyEdge.addClass("blocked-edge");
    } else if (edge.isRestricted) {
      cyEdge.addClass("restricted-edge");
    }
  });

  // Preserve Layout & Center
  restoreEvacuationLayout(cy);

  // Styling: Highlight Source (blue) & Sink (pink)
  if (typeof cancelHighlightedNodes === "function") cancelHighlightedNodes();
  if (typeof highlightSourceAndSink === "function") highlightSourceAndSink();

  // Update UI Elements
  $("#scenario-selector").val(scenario.id);
  $("#scenario-badge")
    .html(`<span class="label ${scenario.badgeClass}">${scenario.badge}</span> <span style="color:#555;font-size:12px;">${scenario.description}</span>`);

  // Clear previous analysis results and min-cut highlights
  clearAnalysisResults();

  // Show the scenario dashboard card
  $("#evacuation-dashboard").show();
  $("#evacuation-results-panel").hide();
}

// --- 5. ONE-CLICK AUTOMATED MAXIMUM-FLOW ANALYSIS ---
function runAutomatedAnalysis() {
  if (!cy || cy.nodes().length === 0) {
    alert("Please load an evacuation graph before running analysis.");
    return;
  }

  // If manual practice mode was active, safely exit practice mode and restore pristine scenario graph
  if (typeof inGraphCreation === "function" && !inGraphCreation()) {
    if (typeof exitManualPracticeMode === "function") {
      exitManualPracticeMode(false);
    }
    if (isEvacuationActive) {
      loadEvacuationScenario(currentScenarioId);
    }
  }

  const currentSource = source || $("#source").text().replace("Source=", "").trim();
  const currentSink = sink || $("#sink").text().replace("Sink=", "").trim();

  if (!currentSource || !currentSink) {
    alert("Source and sink must be designated before running analysis!");
    return;
  }
  if (currentSource === currentSink) {
    alert("Source and sink cannot be the same node!");
    return;
  }

  // 1. Gather original capacities from Cytoscape canvas without mutating it
  const originalEdgeMap = new Map(); // "u->v" -> { source, target, capacity }
  const cyEdges = cy.edges();

  cyEdges.forEach(edge => {
    const rawLabel = edge.css("label");
    // Ignore overlay edges if any
    if (rawLabel.includes("/")) return;
    // Extract numerical capacity from label (e.g. "0 (Blocked)" -> 0, "4 (Restricted)" -> 4)
    const cap = parseFloat(rawLabel);
    if (!isNaN(cap)) {
      const u = String(edge.source().id());
      const v = String(edge.target().id());
      originalEdgeMap.set(u + "->" + v, { source: u, target: v, capacity: cap, cyEdge: edge });
    }
  });

  // 2. Build isolated FlowNetwork model for calculation
  const workingFn = new FlowNetwork(currentSource, currentSink);
  cy.nodes().forEach(node => workingFn.addNode(String(node.id())));
  originalEdgeMap.forEach(e => {
    if (e.capacity > 0) {
      workingFn.addEdge(e.source, e.target, e.capacity);
    }
  });

  // 3. Automated Edmonds-Karp Max-Flow Loop
  let calculatedMaxFlow = 0;
  let augmentingPaths = [];
  let currentSimFn = workingFn;
  let safetyIterations = 0;
  const maxSafety = 500;

  while (safetyIterations++ < maxSafety) {
    const path = currentSimFn.findShortestAugmentingPath();
    if (!path || path.length <= 1) {
      break; // No more augmenting paths
    }

    const edgeList = currentSimFn.convertNodesToEdges(path);
    const [bottleneck, bottleneckEdge, pathMsg] = currentSimFn.findBottleneckCapacity(edgeList);

    if (bottleneck <= 0 || bottleneck === Infinity) {
      break;
    }

    // Add flow to residual network
    const expectedGraph = currentSimFn.addFlow(edgeList, bottleneck, false);
    calculatedMaxFlow += bottleneck;
    augmentingPaths.push({ path: pathMsg, flow: bottleneck });

    // Reconstruct residual FlowNetwork
    const nextFn = new FlowNetwork(currentSource, currentSink);
    for (const [u, neighbors] of expectedGraph) {
      for (const [v, edge] of neighbors) {
        if (edge.capacity > 0) {
          nextFn.addEdge(u, v, edge.capacity);
        }
      }
    }
    currentSimFn = nextFn;
  }

  // 4. Identify S-Cut (nodes reachable from source in final residual graph)
  const reachableNodes = currentSimFn.findMinCut(currentSource);

  // 5. Identify Minimum Cut Edges (original edges with u in S and v not in S, capacity > 0)
  const minCutEdges = [];
  let calculatedCutCapacity = 0;

  originalEdgeMap.forEach(e => {
    if (e.capacity > 0 && reachableNodes.has(e.source) && !reachableNodes.has(e.target)) {
      minCutEdges.push(e);
      calculatedCutCapacity += e.capacity;
    }
  });

  // 6. Handle Disconnected Networks
  const isDisconnected = (calculatedMaxFlow === 0);

  // 7. Verify Max-Flow Min-Cut Theorem
  const theoremVerified = (!isDisconnected && Math.abs(calculatedMaxFlow - calculatedCutCapacity) < 0.0001);

  // 8. Baseline Comparison Calculation
  // If we are analyzing the baseline itself, update the canonical baseline value
  if (currentScenarioId === "normal" && !isDisconnected) {
    baselineMaxFlowValue = calculatedMaxFlow;
  }

  const baseline = baselineMaxFlowValue;
  const absoluteChange = calculatedMaxFlow - baseline;
  const throughputReduction = baseline - calculatedMaxFlow;
  let reductionPercentage = 0;
  let percentageChange = 0;
  if (baseline > 0) {
    reductionPercentage = (throughputReduction / baseline) * 100;
    percentageChange = (absoluteChange / baseline) * 100;
  }

  // Store result
  lastAnalysisResult = {
    scenarioId: currentScenarioId,
    scenarioName: (EVACUATION_SCENARIOS[currentScenarioId] || {}).name || "Custom Configuration",
    maxFlow: calculatedMaxFlow,
    baselineFlow: baseline,
    absoluteChange: absoluteChange,
    throughputReduction: throughputReduction,
    reductionPercentage: reductionPercentage,
    percentageChange: percentageChange,
    minCutEdges: minCutEdges,
    cutCapacity: calculatedCutCapacity,
    augmentingPaths: augmentingPaths,
    reachableCount: reachableNodes.size,
    isDisconnected: isDisconnected,
    theoremVerified: theoremVerified,
    explanation: (EVACUATION_SCENARIOS[currentScenarioId] || {}).bottleneckExplanation || ""
  };

  // 9. Highlight Minimum-Cut Edges on Cytoscape
  highlightMinCutEdges(minCutEdges);

  // 10. Display Results on Dashboard
  renderAnalysisDashboard(lastAnalysisResult);
}

// --- 6. MINIMUM-CUT VISUAL HIGHLIGHTING ---
function highlightMinCutEdges(cutEdges) {
  // Clear any existing min-cut highlights
  cy.edges().removeClass("min-cut-edge");

  if (!cutEdges || cutEdges.length === 0) return;

  cutEdges.forEach(e => {
    const edge = cy.edges(`[source='${e.source}'][target='${e.target}']`);
    if (edge.length > 0) {
      edge.addClass("min-cut-edge");
    }
  });

  // Ensure source and sink styling is maintained
  highlightSourceAndSink();
}

function clearMinCutHighlights() {
  if (cy) {
    cy.edges().removeClass("min-cut-edge");
    highlightSourceAndSink();
  }
}

// --- 7. RESULTS DASHBOARD RENDERING ---
function renderAnalysisDashboard(res) {
  if (!res) return;

  $("#evacuation-results-panel").slideDown(200);

  // Scenario Title
  $("#res-scenario-name").text(res.scenarioName);

  // Max Flow Value
  $("#res-max-flow").html(`<b>${res.maxFlow}</b> <span style="font-size:14px;font-weight:normal;">people/min</span>`);

  // Baseline Comparison
  $("#res-baseline-flow").text(`${res.baselineFlow} people/min`);

  // Comparison metrics badge
  if (res.throughputReduction > 0) {
    $("#res-reduction-badge")
      .html(`<span class="label label-danger" style="font-size:13px;"><i class="fa fa-arrow-down"></i> Capacity Reduction: ${res.throughputReduction} people/min (${res.reductionPercentage.toFixed(1)}%)</span>`);
  } else if (res.throughputReduction === 0) {
    $("#res-reduction-badge")
      .html(`<span class="label label-success" style="font-size:13px;"><i class="fa fa-check"></i> Baseline Capacity (100%)</span>`);
  } else {
    $("#res-reduction-badge")
      .html(`<span class="label label-info" style="font-size:13px;"><i class="fa fa-arrow-up"></i> Capacity Increase: ${Math.abs(res.throughputReduction)} people/min (+${Math.abs(res.reductionPercentage).toFixed(1)}%)</span>`);
  }

  // Absolute difference & Throughput reduction details (Signed Change vs Percentage Reduction)
  const signedPctStr = res.baselineFlow > 0
    ? `${res.percentageChange > 0 ? "+" : ""}${res.percentageChange.toFixed(1)}%`
    : "0.0%";
  $("#res-diff-detail").html(
    `Absolute Change: <b>${res.absoluteChange > 0 ? "+" : ""}${res.absoluteChange}</b> people/min (${signedPctStr}) &nbsp;|&nbsp; Percentage Reduction: <b>${res.reductionPercentage.toFixed(1)}%</b>`
  );

  // Minimum Cut Details
  if (res.isDisconnected) {
    $("#res-mincut-summary").html(
      `<div class="alert alert-danger" style="margin-bottom:8px;padding:8px 12px;">
        <i class="fa fa-exclamation-triangle"></i> <b>Network Disconnected:</b> No path exists between Building Entrance (Source) and Safe Zone (Sink). Modeled throughput is 0 people/min.
      </div>`
    );
    $("#res-cut-edges-list").html("<li>None (Network fully disconnected)</li>");
    $("#res-cut-capacity").text("0 people/min");
  } else {
    $("#res-mincut-summary").html(
      `<div style="font-size:13px;margin-bottom:6px;">
        Total Min-Cut Bottleneck Capacity: <b>${res.cutCapacity} people/min</b>
        ${res.theoremVerified ? '<span class="text-success"><i class="fa fa-check-circle"></i> (Verified: Max Flow = Min Cut)</span>' : ''}
      </div>`
    );

    // List Cut Edges
    let edgesHtml = "";
    res.minCutEdges.forEach(e => {
      // Find friendly names if available
      const srcNode = EVACUATION_BASELINE_NODES.find(n => String(n.id) === String(e.source));
      const tgtNode = EVACUATION_BASELINE_NODES.find(n => String(n.id) === String(e.target));
      const srcName = srcNode ? srcNode.name : `Node ${e.source}`;
      const tgtName = tgtNode ? tgtNode.name : `Node ${e.target}`;

      edgesHtml += `<li style="padding: 2px 0;">
        <span class="label label-default" style="background:#ad1a66;color:white;">${e.source} → ${e.target}</span>
        <b>${srcName} → ${tgtName}</b>:
        <span class="text-danger font-bold">${e.capacity} people/min</span>
      </li>`;
    });
    $("#res-cut-edges-list").html(edgesHtml);
    $("#res-cut-capacity").text(`${res.cutCapacity} people/min`);
  }

  // Bottleneck Explanation
  $("#res-explanation").text(res.explanation);

  // Resize canvas to ensure full view alongside results
  if (typeof resizeAndCenterAccordingToCurrentGraphBlock === "function") {
    resizeAndCenterAccordingToCurrentGraphBlock();
  }
}

// --- 8. RESET & CLEAR LOGIC ---
function clearAnalysisResults() {
  lastAnalysisResult = null;
  clearMinCutHighlights();
  $("#evacuation-results-panel").slideUp(150);
  $("#res-cut-edges-list").empty();
  $("#res-scenario-name").text("-");
  $("#res-max-flow").text("-");
  $("#res-baseline-flow").text("-");
  $("#res-reduction-badge").empty();
  $("#res-diff-detail").empty();
  $("#res-explanation").text("-");
}

function resetAnalysis() {
  clearAnalysisResults();
  if (typeof exitManualPracticeMode === "function") {
    exitManualPracticeMode(false);
  }
  if (isEvacuationActive) {
    // Reload the currently active scenario to restore pristine state and coordinates
    loadEvacuationScenario(currentScenarioId);
  } else {
    // Generic example reset
    if (typeof createExampleGraph === "function") {
      createExampleGraph();
    }
  }
}

// Invalidate stale results when graph elements or capacities change
function invalidateStaleAnalysis() {
  if (lastAnalysisResult) {
    $("#res-reduction-badge").html(
      `<span class="label label-warning"><i class="fa fa-pencil"></i> Graph Modified — Re-run Analysis</span>`
    );
  }
}

// --- 9. EVENT BINDINGS ON DOM READY ---
$(function () {
  // Scenario selector change
  $("#scenario-selector").on("change", function () {
    const selected = $(this).val();
    loadEvacuationScenario(selected);
  });

  // Run Analysis button
  $("#run-analysis-btn").on("click", function (e) {
    e.preventDefault();
    runAutomatedAnalysis();
  });

  // Reset Analysis button
  $("#reset-analysis-btn").on("click", function (e) {
    e.preventDefault();
    resetAnalysis();
  });

  // Hook into graph modification events to invalidate results if user manually modifies graph
  if (typeof cy !== "undefined" && cy.on) {
    cy.on("add remove", "node, edge", function () {
      invalidateStaleAnalysis();
    });
  }
});
