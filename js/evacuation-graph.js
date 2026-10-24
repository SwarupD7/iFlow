// ============================================================================
// EVACUATION SAMPLE GRAPH DEFINITION
// Campus Evacuation Capacity Analyzer — DAA Course Project
//
// This file defines a predefined college building evacuation network.
// Nodes represent rooms, corridor junctions, staircases, and exits.
// Edges represent directed passages with capacities in people per minute.
//
// GRAPH STRUCTURE (12 nodes, 17 edges):
//
//   [Source]                                                    [Sink]
//   Building  → Room 101 → Corridor Jn A → Staircase A → North Exit → Safe
//   Entrance  → Room 102 ↗               ↘ Main Corridor ↗            ↗ Zone
//             → Room 103 → Corridor Jn B → Staircase B → South Exit ↗
//
// HAND-VERIFIED EXPECTED MAXIMUM FLOW: 23 people/min
//
// Min-cut edges (one valid S-cut):
//   Staircase A → North Exit (cap 10)
//   Main Corridor → North Exit (cap 3)
//   Staircase B → South Exit (cap 7)
//   Main Corridor → South Exit (cap 3)
//   Total min-cut capacity = 10 + 3 + 7 + 3 = 23 people/min
//
// ============================================================================

/**
 * Creates the predefined evacuation sample graph.
 * Clears the existing graph first, then adds nodes and edges.
 * Sets source = "1" (Building Entrance) and sink = "12" (Safe Zone).
 *
 * @param {Event} e - The click event (will be preventDefault'd if present)
 */
function createEvacuationGraph(e) {
  // Clear existing graph (reuses the existing clear handler)
  $("#clear").triggerHandler("click");
  if (e && e.preventDefault) e.preventDefault();

  // Define source and sink
  source = "1";
  sink = "12";
  $("#source").text("Source=" + source);
  $("#sink").text("Sink=" + sink);

  // Node definitions: id (numeric), name (descriptive label), x/y position
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

  // Edge definitions: capacity in illustrative people per minute
  var edges = [
    // From source (Building Entrance) to rooms
    { id: "1-2",  source: 1,  target: 2,  label: 10 },  // Entrance → Room 101
    { id: "1-3",  source: 1,  target: 3,  label: 8  },  // Entrance → Room 102
    { id: "1-4",  source: 1,  target: 4,  label: 7  },  // Entrance → Room 103

    // From rooms to corridor junctions
    { id: "2-5",  source: 2,  target: 5,  label: 8  },  // Room 101 → Corridor Jn A
    { id: "3-5",  source: 3,  target: 5,  label: 5  },  // Room 102 → Corridor Jn A
    { id: "3-6",  source: 3,  target: 6,  label: 4  },  // Room 102 → Corridor Jn B
    { id: "4-6",  source: 4,  target: 6,  label: 7  },  // Room 103 → Corridor Jn B

    // From corridor junctions to staircases/main corridor
    { id: "5-7",  source: 5,  target: 7,  label: 10 },  // Corridor Jn A → Staircase A
    { id: "5-8",  source: 5,  target: 8,  label: 4  },  // Corridor Jn A → Main Corridor
    { id: "6-8",  source: 6,  target: 8,  label: 3  },  // Corridor Jn B → Main Corridor
    { id: "6-9",  source: 6,  target: 9,  label: 8  },  // Corridor Jn B → Staircase B

    // From staircases/main corridor to exits
    { id: "7-10", source: 7,  target: 10, label: 10 },  // Staircase A → North Exit
    { id: "8-10", source: 8,  target: 10, label: 3  },  // Main Corridor → North Exit
    { id: "8-11", source: 8,  target: 11, label: 3  },  // Main Corridor → South Exit
    { id: "9-11", source: 9,  target: 11, label: 7  },  // Staircase B → South Exit

    // From exits to sink (Safe Zone)
    { id: "10-12", source: 10, target: 12, label: 13 },  // North Exit → Safe Zone
    { id: "11-12", source: 11, target: 12, label: 10 },  // South Exit → Safe Zone
  ];

  // Add all nodes
  nodes.forEach(function (node) {
    addNode(cy, node.id, node.name, node.x, node.y);
  });

  // Add all edges
  edges.forEach(function (edge) {
    addEdge(cy, edge.id, { label: edge.label }, edge.source, edge.target);
  });

  // Apply source/sink highlighting
  cancelHighlightedNodes();
  highlightSourceAndSink();
}
