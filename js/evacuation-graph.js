// ============================================================================
// EVACUATION SAMPLE GRAPH DEFINITION
// Campus Evacuation Capacity Analyzer — DAA Course Project
//
// This file coordinates evacuation graph loading and delegates to the
// evacuation scenarios module for baseline management and scenario loading.
// ============================================================================

/**
 * Creates the predefined evacuation sample graph (Normal Operation baseline).
 * Clears the existing graph first, sets source=1 and sink=12,
 * positions all 12 nodes at preset coordinates, and applies baseline capacities.
 *
 * @param {Event} e - Optional click event
 */
function createEvacuationGraph(e) {
  if (e && e.preventDefault) e.preventDefault();

  if (typeof loadEvacuationScenario === "function") {
    loadEvacuationScenario("normal");
  } else {
    // Fallback if scenarios module not yet loaded
    $("#clear").triggerHandler("click");
    source = "1";
    sink = "12";
    $("#source").text("Source=" + source);
    $("#sink").text("Sink=" + sink);

    var nodes = [
      { id: 1,  name: "Building Entrance",  x: 80,  y: 280 },
      { id: 2,  name: "Room 101",           x: 250, y: 120 },
      { id: 3,  name: "Room 102",           x: 250, y: 280 },
      { id: 4,  name: "Room 103",           x: 250, y: 440 },
      { id: 5,  name: "Corridor Jn A",      x: 420, y: 160 },
      { id: 6,  name: "Corridor Jn B",      x: 420, y: 400 },
      { id: 7,  name: "Staircase A",        x: 570, y: 120 },
      { id: 8,  name: "Main Corridor",      x: 570, y: 280 },
      { id: 9,  name: "Staircase B",        x: 570, y: 440 },
      { id: 10, name: "North Exit",         x: 730, y: 160 },
      { id: 11, name: "South Exit",         x: 730, y: 400 },
      { id: 12, name: "Safe Zone",          x: 880, y: 280 },
    ];

    var edges = [
      { id: "1-2",  source: 1,  target: 2,  label: 10 },
      { id: "1-3",  source: 1,  target: 3,  label: 8  },
      { id: "1-4",  source: 1,  target: 4,  label: 7  },
      { id: "2-5",  source: 2,  target: 5,  label: 8  },
      { id: "3-5",  source: 3,  target: 5,  label: 5  },
      { id: "3-6",  source: 3,  target: 6,  label: 4  },
      { id: "4-6",  source: 4,  target: 6,  label: 7  },
      { id: "5-7",  source: 5,  target: 7,  label: 10 },
      { id: "5-8",  source: 5,  target: 8,  label: 4  },
      { id: "6-8",  source: 6,  target: 8,  label: 3  },
      { id: "6-9",  source: 6,  target: 9,  label: 8  },
      { id: "7-10", source: 7,  target: 10, label: 10 },
      { id: "8-10", source: 8,  target: 10, label: 3  },
      { id: "8-11", source: 8,  target: 11, label: 3  },
      { id: "9-11", source: 9,  target: 11, label: 7  },
      { id: "10-12", source: 10, target: 12, label: 13 },
      { id: "11-12", source: 11, target: 12, label: 10 },
    ];

    nodes.forEach(function (node) {
      addNode(cy, node.id, node.name, node.x, node.y);
    });

    edges.forEach(function (edge) {
      addEdge(cy, edge.id, { label: edge.label }, edge.source, edge.target);
    });

    cancelHighlightedNodes();
    highlightSourceAndSink();
  }
}
