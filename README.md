# Campus Evacuation Capacity Analyzer

**Graph-Based Emergency Evacuation Capacity Optimization Using Maximum Flow and Minimum Cut Algorithms**
*A Design and Analysis of Algorithms (DAA) Course Project*

---

## 1. Project Title and Overview

The **Campus Evacuation Capacity Analyzer** is a web-based algorithmic modeling and visualization tool developed as a DAA course project. It models a multi-story college building as a directed flow network and analyzes its emergency evacuation capacity under normal and compromised operating conditions using classical **Maximum Flow** and **Minimum Cut** graph algorithms.

The application allows safety planners, students, and engineers to interactively explore how structural blockages (such as an impassable staircase) or physical bottlenecks (such as a restricted doorway) reduce the network's total egress throughput, highlighting critical bottleneck edges and validating the fundamental **Max-Flow Min-Cut Theorem**.

---

## 2. Problem Statement and Objectives

During a building emergency (such as a fire, earthquake, or hazardous spill), occupants must quickly evacuate from classrooms, lecture halls, and laboratories to safe outdoor zones through corridors, stairwells, and emergency exits. Each passage has a physical constraint—its **width and carrying capacity**—limiting how many people can safely pass per unit time.

### Key Objectives
1. **Model Building Evacuation Topologies:** Represent classrooms, hallways, stairwells, and exits as a directed graph $G = (V, E)$ with edge capacities.
2. **Compute Maximum Egress Throughput:** Apply the Edmonds–Karp and Ford–Fulkerson maximum-flow algorithms to compute the peak evacuation rate.
3. **Identify Critical Bottlenecks:** Use the Minimum Cut algorithm on the residual network to pinpoint the exact structural passages that limit building-wide evacuation.
4. **Evaluate Emergency Scenarios:** Quantify and compare egress capacity across multiple emergency scenarios (e.g., blocked staircases, smoke-filled exits).
5. **Facilitate Algorithmic Learning:** Provide both interactive step-by-step practice (manual augmenting-path selection) and one-click automated scenario analysis with visual graph highlighting.

---

## 3. Real-World Motivation

In architectural safety and egress planning (e.g., NFPA 101 Life Safety Code guidelines), evacuation safety often fails not because total building capacity is insufficient, but because a single congested bottleneck throttles flow.

When a primary exit route is suddenly compromised, evacuees divert to secondary paths that may have lower capacity, causing severe localized crowd pressure. Algorithmic flow network analysis provides an objective, mathematical method to identify these vulnerabilities before an actual emergency occurs, enabling proactive capacity upgrades, better signage, and balanced exit allocation.

---

## 4. Project Scope and Limitations

> **IMPORTANT NOTICE:**
> This application is an **algorithm-based planning and educational tool**, not a certified real-time emergency response or life-safety simulation system.

- **Throughput vs. Evacuation Time:** The primary metric computed is **modeled throughput** (measured in **people per minute**). The initial model does not predict exact real-world evacuation time in seconds, as that requires continuous crowd-density simulations (e.g., social force models, walking speed deceleration, or smoke dispersion models).
- **Steady-State Assumptions:** Flow capacities assume constant, unimpeded rates along clear passages without modeling panic surges or physical compression at doors.
- **Single-Commodity Flow:** All occupants are treated as a homogeneous flow toward the safe exterior zone.

---

## 5. Implemented Features

This project extends the open-source **iFlow** educational visualizer into an evacuation-specific capacity optimization platform.

### Evacuation-Specific Features (Our Contributions)
- **Predefined Campus Evacuation Network:** A 12-node, 17-edge directed graph representing a college facility (rooms, hallway junctions, stairwells, exits, and a safe assembly zone).
- **Descriptive Labels with Stable Numeric IDs:** Internal graph operations use numeric IDs (`1` to `12`), while the UI renders meaningful labels (`"Room 101"`, `"Staircase A"`, `"North Exit"`, `"Safe Zone"`).
- **Preset Structural Layout:** Fixed Cartesian coordinates for all 12 evacuation nodes ensure that the spatial layout remains consistent and intuitive across operations.
- **Three Predefined Scenarios:**
  1. *Scenario 1: Normal Operation (Baseline)* — All routes at design capacities.
  2. *Scenario 2: Blocked Staircase A* — Staircase A completely impassable (capacity = 0).
  3. *Scenario 3: Restricted North Exit* — Heavy smoke/debris constricts North Exit capacity from 13 down to 4 people/min.
- **One-Click Automated Maximum-Flow Analysis:** Solves the network using Edmonds-Karp, extracts the residual $S$-cut, and verifies the Max-Flow Min-Cut Theorem.
- **Automated Bottleneck (Min-Cut) Highlighting:** Cytoscape edges corresponding to the minimum cut are dynamically styled with distinct highlighted borders.
- **Comparative Analysis Dashboard:** Displays scenario throughput, absolute difference ($\Delta F$), signed percentage change ($\pm\%$), positive percentage reduction, and contextual bottleneck explanations.
- **UI State Machine Synchronization:** Automatically exits manual practice mode when running automated analysis or switching scenarios, eliminating stale UI controls.
- **Automated Regression Test Suite:** Headless Node.js test suites covering algorithm correctness, theorem verification, scenario switching, layout preservation, and UI state transitions.

### Inherited Core iFlow Features
- Interactive manual augmenting path selection (clickable path definition).
- Interactive flow adjustment and residual graph updating.
- Three augmenting path finding heuristics:
  - Edmonds-Karp (BFS shortest path)
  - Ford-Fulkerson (DFS randomized path)
  - Widest-Path heuristic (Dijkstra-style priority queue)
- Interactive and automated generic Minimum Cut validation.
- Cytoscape graph canvas with zoom, pan, and interactive node/edge editing.
- Graph export and import via JSON.

---

## 6. Technology Stack

- **Frontend Core:** HTML5, CSS3, Twitter Bootstrap 3.3.7, jQuery 3.1.1.
- **Graph Visualization:** Cytoscape.js (v3.18.0) with `cytoscape-edgehandles` and `cytoscape-panzoom`.
- **Data Structures & Utilities:** Lodash (v4.17.21), FontAwesome 4.7.0.
- **Custom Algorithm Engine:** Pure vanilla JavaScript ES6 (`js/model/max-flow.js`, `js/model/priority-queue.js`).
- **Testing Runtime:** Node.js (v18+) with standard `assert` and `child_process` modules (no external npm dependencies required).

---

## 7. Architecture and Directory Structure

```
D:\DAA-Projects\iFlow\
├── index.html                      # Main single-page application UI
├── LICENSE                         # Original MIT License
├── README.md                       # Project documentation
├── assets/                         # UI screenshots and visual assets
├── css/
│   ├── bootstrap.min.css           # Bootstrap styling
│   ├── cy.css                      # Cytoscape & custom scenario/dashboard CSS
│   └── style.css                   # General layout styles
├── docs/
│   ├── complexity.md               # Rigorous time and space complexity analysis
│   └── viva-qa.md                  # 30 comprehensive viva voce questions and model answers
├── js/
│   ├── app.js                      # Main application controller & state machine
│   ├── evacuation-graph.js         # Evacuation graph initialization helper
│   ├── evacuation-scenarios.js     # Scenario definitions, automated solver & dashboard
│   ├── cytoscape-settings/
│   │   └── cytoscape-settings.js   # Cytoscape styling, edge classes, node shapes
│   ├── interactivity/
│   │   ├── interactivity.js        # Mouse, keyboard, and button interaction handlers
│   │   └── interactivity-helper.js # ID generators and selection utilities
│   ├── model/
│   │   ├── max-flow.js             # FlowNetwork, Edge, BFS, DFS, and MinCut classes
│   │   └── priority-queue.js       # Binary max-heap priority queue for Widest Path
│   └── utils/
│       ├── file-layout-utils.js    # JSON import/export and layout controls
│       └── utils.js                # Helper utilities
├── tests/
│   ├── run-all-tests.js            # Master test runner (executes all suites)
│   ├── test-flow-network.js        # FlowNetwork & max-flow algorithm unit tests
│   └── test-scenarios-and-ui.js    # Scenarios, metrics, and UI state integration tests
└── vendor/                         # Local vendor JS & CSS libraries
```

---

## 8. Graph Representation and Capacity Assumptions

### Node Mapping

| Node ID | Display Name | Role in Network |
|:---:|---|---|
| **1** | Building Entrance | **Source ($s$)** — Evacuation origin distribution point |
| **2** | Room 101 | Classroom / occupancy area (West wing) |
| **3** | Room 102 | Classroom / occupancy area (Central) |
| **4** | Room 103 | Classroom / occupancy area (East wing) |
| **5** | Corridor Jn A | Hallway intersection connecting Rooms 101 & 102 |
| **6** | Corridor Jn B | Hallway intersection connecting Rooms 102 & 103 |
| **7** | Staircase A | Primary egress stairwell (West side) |
| **8** | Main Corridor | Central ground-floor arterial corridor |
| **9** | Staircase B | Secondary egress stairwell (East side) |
| **10** | North Exit | Ground-floor emergency discharge door (North) |
| **11** | South Exit | Ground-floor emergency discharge door (South) |
| **12** | Safe Zone | **Sink ($t$)** — Exterior assembly safe area |

### Baseline Edge Capacities (People / Minute)
- `1->2`: 10 | `1->3`: 8 | `1->4`: 7 *(Total origin feed = 25)*
- `2->5`: 8 | `3->5`: 5 | `3->6`: 4 | `4->6`: 7
- `5->7`: 10 | `5->8`: 4 | `6->8`: 3 | `6->9`: 8
- `7->10`: 10 | `8->10`: 3 | `8->11`: 3 | `9->11`: 7
- `10->12`: 13 | `11->12`: 10 *(Total exterior discharge limit = 23)*

---

## 9. Installation and Run Instructions

The application requires no build steps, bundlers, or package installations. It runs directly in any modern web browser.

### Running Locally on Windows

1. Open PowerShell or Command Prompt.
2. Navigate to the project directory:
   ```powershell
   cd D:\DAA-Projects\iFlow
   ```
3. Start a lightweight local HTTP server using Python:
   ```powershell
   py -m http.server 8080
   ```
4. Open your web browser and navigate to:
   ```
   http://127.0.0.1:8080/
   ```
5. To stop the local server, press `Ctrl+C` in the terminal window.

---

## 10. User Instructions for the Three Scenarios

1. **Load Evacuation Example:**
   Click the **"Load Evacuation Example"** button in the left sidebar (or it will load automatically on startup).
2. **Select an Evacuation Scenario:**
   Use the **Evacuation Scenario** dropdown in the top toolbar to choose between:
   - **Scenario 1: Normal Operation (Baseline):** Full building capacity.
   - **Scenario 2: Blocked Staircase A:** Staircase A (`5->7`) capacity is throttled to `0 (Blocked)`.
   - **Scenario 3: Restricted North Exit:** North Exit doorway (`10->12`) capacity is throttled to `4 (Restricted)`.
3. **Run Automated Analysis:**
   Click the green/blue **"Run Analysis"** button. The application executes Edmonds-Karp, highlights the minimum-cut bottleneck edges in bold magenta, and opens the results dashboard.
4. **Inspect Results Dashboard:**
   Review Scenario Maximum Flow, Baseline Comparison, Min-Cut capacity, and the structural bottleneck explanation.
5. **Reset Analysis:**
   Click **"Reset Analysis"** to restore pristine baseline capacities and clear highlights.
6. **Switch to Generic Practice:**
   Click **"Generic Example"** to switch to the original 8-node tutorial graph at any time.

---

## 11. Automated Maximum-Flow Analysis

When **"Run Analysis"** is clicked, `runAutomatedAnalysis()` (`js/evacuation-scenarios.js`):
1. Instantiates a dedicated `FlowNetwork` instance isolated from Cytoscape DOM elements.
2. Executes an augmenting-path loop using **Edmonds-Karp (BFS)**.
3. In each iteration, finds the shortest augmenting path from source (Node 1) to sink (Node 12).
4. Calculates bottleneck capacity $\delta = \min_{(u,v)} (c(u,v) - f(u,v))$.
5. Augments flow along the path and updates forward and reverse residual capacities.
6. Terminates when no augmenting path with positive capacity exists in $G_f$.

---

## 12. Minimum-Cut and Bottleneck Explanation

By the **Max-Flow Min-Cut Theorem**, the maximum flow through a network is strictly bounded by the capacity of its minimum cut.

1. **$S$-Cut Reachability:** After flow augmentation terminates, a Depth-First Search is initiated from Source $s$ in the final residual graph $G_f$, traversing only edges with $c_f(u, v) > 0$.
2. **Cut Edges:** Any original directed edge $(u, v)$ where $u \in S$ and $v \notin S$ with original capacity $c(u, v) > 0$ crosses the bottleneck.
3. **Visual Highlighting:** These bottleneck edges are highlighted in bright magenta (`#ad1a66`) on the canvas, showing safety personnel exactly where passage widening or alternate routing is required.

---

## 13. Residual Graph Explanation

A critical DAA concept visualized in this project is the **residual network** ($G_f$):
- **Forward Edges:** Represent remaining available passage capacity:
  $$c_f(u, v) = c(u, v) - f(u, v)$$
- **Reverse Edges:** Represent flow that can be "canceled" or redirected:
  $$c_f(v, u) = f(u, v)$$
Reverse edges allow the algorithm to correct sub-optimal path choices made in earlier iterations without combinatorial backtracking.

---

## 14. Algorithm Complexity Summary

| Algorithm / Subroutine | Method | Time Complexity | Space Complexity |
|---|---|---|---|
| **Edmonds–Karp (Automated Solver)** | BFS Augmenting Paths | $\mathcal{O}(\|V\| \times \|E\|^2)$ | $\mathcal{O}(\|V\| + \|E\|)$ |
| **Ford–Fulkerson** | DFS Augmenting Paths | $\mathcal{O}(\|E\| \times \|F\|)$ *(integer capacities)* | $\mathcal{O}(\|V\| + \|E\|)$ |
| **Widest Path Heuristic** | Modified Dijkstra + Binary Heap | $\mathcal{O}(\|E\|^2 \log \|V\| \log \|F\|)$ | $\mathcal{O}(\|V\| + \|E\|)$ |
| **Minimum-Cut Extraction** | Residual Graph DFS | $\mathcal{O}(\|V\| + \|E\|)$ | $\mathcal{O}(\|V\|)$ |

*For complete mathematical proofs, derivation bounds, and asymptotic details, see [`docs/complexity.md`](file:///D:/DAA-Projects/iFlow/docs/complexity.md).*

---

## 15. Testing Instructions and Actual Verified Results

### Running the Automated Test Suite

Ensure Node.js is installed, then execute:

```powershell
cd D:\DAA-Projects\iFlow
node tests/run-all-tests.js
```

### Verified Test Results

```
====================================================================
   CAMPUS EVACUATION CAPACITY ANALYZER — MASTER TEST SUITE RUNNER
====================================================================
>>> RUNNING SUITE: Algorithm & FlowNetwork Tests
[Test 1] Single Edge Graph (Source -> Sink, Cap: 7) ... PASSED ✔
[Test 2] Two Independent Paths (S->A->T: 4, S->B->T: 6) ... PASSED ✔
[Test 3] Shared Bottleneck Graph ... PASSED ✔
[Test 4] Reverse Edge Rerouting ... PASSED ✔
[Test 5] Disconnected Network ... PASSED ✔
[Test 6] Zero-Capacity Blocked Edges ... PASSED ✔
[Test 7] Malformed Input Handling (Self-loop S->S, Isolated node C) ... PASSED ✔
[Test 8] Generic 8-Node Example (Expected: 11) ... PASSED ✔
[Test 9] Scenario 1: Normal Operation (Expected: 23 people/min) ... PASSED ✔
[Test 10] Scenario 2: Blocked Staircase A (Expected: 13 people/min) ... PASSED ✔
[Test 11] Scenario 3: Restricted North Exit (Expected: 14 people/min) ... PASSED ✔
[Test 12] Algorithm Consistency: Edmonds-Karp vs Widest Path ... PASSED ✔
>>> SUITE PASSED: Algorithm & FlowNetwork Tests ✔

>>> RUNNING SUITE: Scenarios & UI State Integration Tests
[Test 1] Baseline Comparison Metrics (Reduction, Signed Change, Zero Guard) ... PASSED ✔
[Test 2] Predefined Scenarios & Baseline Edge Immutability ... PASSED ✔
[Test 3] Layout Preservation: Preset Coordinates across all 12 nodes ... PASSED ✔
[Test 4] Scenario Switching Cycles (5 continuous rounds) ... PASSED ✔
[Test 5] UI State Machine: Practice Mode Activation and Clean Exit ... PASSED ✔
[Test 6] Run Analysis while Manual Practice is Active ... PASSED ✔
[Test 7] Reset Analysis Restores Pristine State & Clears Dashboard ... PASSED ✔
[Test 8] Switch from Evacuation to Generic Example ... PASSED ✔
[Test 9] Manual Practice Start Over Snapshot Lifecycle ... PASSED ✔
>>> SUITE PASSED: Scenarios & UI State Integration Tests ✔

====================================================================
Suites Passed: 2 / 2 (21 / 21 individual tests passed, 0 failed)
====================================================================
```

### Verified Scenario Reference Values

| Scenario | Max Flow ($F$) | Min-Cut Capacity | Capacity Reduction | Signed Change | Min-Cut Bottleneck Edges |
|---|:---:|:---:|:---:|:---:|---|
| **Scenario 1: Normal Operation** | **23** | **23** | 0 people/min (0.0%) | 0 (0.0%) | `1->3` (8), `1->4` (7), `2->5` (8) |
| **Scenario 2: Blocked Staircase A** | **13** | **13** | 10 people/min (43.5%) | -10 (-43.5%) | `8->10` (3), `8->11` (3), `9->11` (7) |
| **Scenario 3: Restricted North Exit** | **14** | **14** | 9 people/min (39.1%) | -9 (-39.1%) | `8->11` (3), `9->11` (7), `10->12` (4) |
| **Generic Example (8 Nodes)** | **11** | **11** | — | — | `4->7` (7), `7->8` (4) |

---

## 16. Known Limitations and Future Scope

### Limitations
1. **Static Flow Network:** Does not model time-expanded flows or walking velocity deceleration as crowd density increases.
2. **Homogeneous Occupants:** Does not model mobility-impaired individuals or varied walking speeds.
3. **Deterministic Routing:** Assumes occupants distribute optimally according to capacity rather than personal exit familiarity or herd mentality.

### Future Scope
- **Time-Expanded Dynamic Graphs:** Model evacuation duration in seconds by expanding the graph into discrete time layers $t = 0, 1, 2, \dots, T$.
- **Multi-Commodity Flow:** Separate occupant flows by floor or disability tier with conflicting priority weights.
- **BIM / Floorplan GeoJSON Import:** Automatically generate flow networks from AutoCAD/Revit floorplans.

---

## 17. Original Repository Attribution and Licensing

This project is built upon the open-source **iFlow** educational visualizer:

- **Original Authors:** Muyang Ye, Tianrui Xia, Tianxin Zu, Qian Wang, David Kempe (University of Southern California).
- **Original Paper:** *iFlow - An Interactive Max-Flow Min-Cut Algorithms Visualizer*, ACM SIGCSE 2025. [https://doi.org/10.1145/3641554.3701869](https://doi.org/10.1145/3641554.3701869)
- **Original Repository:** [https://github.com/Maxflow-Visualization/iFlow](https://github.com/Maxflow-Visualization/iFlow)
- **License:** The original iFlow project and our DAA modifications are released under the terms of the **MIT License** (see [`LICENSE`](file:///D:/DAA-Projects/iFlow/LICENSE)).
