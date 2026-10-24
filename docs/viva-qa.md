# Viva Voce Preparation Guide: Questions and Model Answers

**Project Title:** Graph-Based Emergency Evacuation Capacity Optimization Using Maximum Flow and Minimum Cut Algorithms
**Application Name:** Campus Evacuation Capacity Analyzer
**Course:** Design and Analysis of Algorithms (DAA)
**Project Directory:** `D:\DAA-Projects\iFlow`

---

## Table of Contents
1. [Category 1: Project Overview & Objectives (Q1 – Q5)](#category-1-project-overview--objectives)
2. [Category 2: Graph Theory & Modeling (Q6 – Q10)](#category-2-graph-theory--modeling)
3. [Category 3: Algorithms & Computational Complexity (Q11 – Q17)](#category-3-algorithms--computational-complexity)
4. [Category 4: Minimum Cut & Algorithmic Correctness (Q18 – Q22)](#category-4-minimum-cut--algorithmic-correctness)
5. [Category 5: Evacuation Scenarios & Comparative Analysis (Q23 – Q26)](#category-5-evacuation-scenarios--comparative-analysis)
6. [Category 6: Implementation Architecture & Testing (Q27 – Q30)](#category-6-implementation-architecture--testing)

---

## Category 1: Project Overview & Objectives

### Q1: What is the core problem statement and objective of this project?
**Answer:**
The objective is to model a college building's multi-corridor, multi-exit evacuation network using directed graph theory and analyze its emergency crowd throughput using Maximum Flow and Minimum Cut algorithms. By identifying network bottlenecks (minimum cuts), the application demonstrates how structural blockages (e.g., a smoke-filled staircase) or doorway constrictions impair overall building egress capacity, allowing safety planners to optimize exit allocation.

### Q2: Why is this project specifically appropriate for a DAA (Design and Analysis of Algorithms) course?
**Answer:**
It directly applies canonical DAA concepts to a practical network optimization problem:
- Directed flow networks with capacity constraints and conservation of flow.
- Classical augmenting path algorithms: Ford-Fulkerson (DFS), Edmonds-Karp (BFS), and Widest Path (Dijkstra-style priority queue).
- The fundamental Max-Flow Min-Cut Theorem to identify structural bottlenecks.
- Asymptotic time and space complexity analysis across different path-selection heuristics.
- Residual graph manipulation, reverse edge rerouting, and reachability partitioning.

### Q3: What was the starting foundation of this project and what are your original contributions?
**Answer:**
The project is built on the open-source **iFlow** repository (an educational visualizer developed at USC using HTML5, Cytoscape.js, Bootstrap, jQuery, and a custom vanilla JavaScript `FlowNetwork` model).
**Our Contributions:**
1. Formulated a realistic 12-node, 17-edge campus building evacuation topology with preset coordinates for structural clarity.
2. Implemented numeric internal IDs mapped to descriptive room/corridor/staircase/exit display labels.
3. Created three predefined evacuation scenarios (Normal Baseline, Blocked Staircase A, and Restricted North Exit).
4. Engineered an automated, one-click evacuation analysis engine using Edmonds-Karp with automated residual min-cut extraction.
5. Built an interactive results dashboard featuring comparative capacity reduction, signed percentage change, bottleneck edge highlighting, and dynamic explanations.
6. Resolved core state-management bugs (`originalFlowNetwork` lifecycle, manual-practice state leaking into automated analysis, and layout preservation).
7. Developed an automated test suite verifying algorithm correctness, scenario switching invariants, and UI state transitions.

### Q4: Does this tool calculate real-world evacuation time? What are its scope boundaries?
**Answer:**
No. As clearly stated in the application and documentation, this tool calculates **modeled network throughput** in **people per minute**. Real-world evacuation duration depends on non-linear human crowd dynamics, walking velocity, density-dependent flow deceleration (e.g., Greenshields or Weidmann models), queuing delays, and smoke inhalation. Our project is an algorithmic capacity planning and educational optimization tool, not a certified life-safety evacuation simulator.

### Q5: What unit of measurement is used for edge capacity and maximum flow?
**Answer:**
Capacities and flows are measured in **people per minute** (representing the rate of flow that a hallway, doorway, or stairwell of given width can support according to fire-safety engineering standards, such as NFPA egress guidelines).

---

## Category 2: Graph Theory & Modeling

### Q6: How is the physical building mapped into a directed graph $G = (V, E)$?
**Answer:**
- **Vertices ($V$):** Physical locations within the facility. In our model, $|V| = 12$:
  - Node 1: Building Entrance (designated Source $s$)
  - Nodes 2, 3, 4: Classrooms (Rooms 101, 102, 103)
  - Nodes 5, 6: Hallway Junctions (Corridor Jn A, Corridor Jn B)
  - Nodes 7, 9: Stairwells (Staircase A, Staircase B)
  - Node 8: Main Central Corridor
  - Nodes 10, 11: Ground-Floor Emergency Exits (North Exit, South Exit)
  - Node 12: Safe Exterior Assembly Zone (designated Sink $t$)
- **Edges ($E$):** Passages, corridors, doors, and stairs connecting rooms to exits ($|E| = 17$).
- **Direction:** Arrows indicate designated one-way emergency egress movement away from hazards toward safety.

### Q7: What are the mathematical conditions that define a valid flow in this network?
**Answer:**
For a directed network $G = (V, E)$ with capacity function $c: E \to \mathbb{R}^+$ and flow function $f: E \to \mathbb{R}^+$:
1. **Capacity Constraint:** For every edge $(u, v) \in E$, $0 \le f(u, v) \le c(u, v)$. Flow cannot exceed passage capacity.
2. **Skew Symmetry (in residual representation):** $f(u, v) = -f(v, u)$.
3. **Conservation of Flow:** For every vertex $u \in V \setminus \{s, t\}$:
   $$\sum_{v \in V} f(v, u) = \sum_{w \in V} f(u, w)$$
   Total crowd entering any intermediate junction or staircase must equal the total crowd leaving it. No people can disappear or pool permanently at an internal node.

### Q8: Why are numeric internal IDs separated from display labels in the UI?
**Answer:**
Separating internal IDs (e.g., `1`, `7`, `10`) from visual display labels (e.g., `"Building Entrance"`, `"Staircase A"`, `"North Exit"`) provides:
- Stable, immutable, high-efficiency graph lookup keys in JavaScript `Map` and Cytoscape selectors.
- Immunity to label typos or localized string changes.
- Human-friendly UI readability without complicating algorithm operations like BFS predecessor maps or edge lookup keys (`"7-10"`).

### Q9: Why is there only one source and one sink if people start in multiple rooms and exit to multiple doors?
**Answer:**
In classical flow network theory, a multi-source multi-sink network is reduced to a standard single-source single-sink network by introducing:
- A **Supersource ($s$)** connected to all origin rooms with capacities equal to initial room populations.
- A **Supersink ($t$)** connected from all ground-floor exits with capacities equal to exterior discharge limits.
In our model, Node 1 acts as the entrance/origin distribution hub and Node 12 acts as the safe assembly zone (supersink), enabling direct execution of standard max-flow algorithms.

### Q10: How does the network prevent reverse egress flows during an evacuation?
**Answer:**
The baseline physical graph is strictly a **directed acyclic or forward-directed graph**. While the *residual graph* $G_f$ dynamically introduces reverse edges with capacity $f(u, v)$ for mathematical rerouting, those reverse edges only exist in memory during algorithm execution to cancel sub-optimal earlier augmentations; they do not represent people running backwards into burning rooms.

---

## Category 3: Algorithms & Computational Complexity

### Q11: What is the fundamental difference between Ford-Fulkerson and Edmonds-Karp?
**Answer:**
- **Ford-Fulkerson** is a general algorithmic framework or method that repeatedly finds *any* augmenting path from $s$ to $t$ (traditionally using DFS). Its runtime depends on edge capacities: $\mathcal{O}(|E| \times |F|)$ with integer capacities, making it pseudo-polynomial and potentially very slow on pathological networks.
- **Edmonds-Karp** is a specific, fully-polynomial implementation of Ford-Fulkerson that strictly selects the **shortest augmenting path** (in terms of number of edges) using **Breadth-First Search (BFS)**. Its runtime is strictly $\mathcal{O}(|V| \times |E|^2)$, completely independent of edge capacities.

### Q12: Why does Edmonds-Karp guarantee polynomial runtime $\mathcal{O}(|V| \cdot |E|^2)$?
**Answer:**
Because BFS always finds the path with the fewest edges, the shortest-path distance $d(s, v)$ from the source to any vertex $v$ in the residual graph increases monotonically across augmentations. An edge $(u, v)$ can become critical (saturated) at most $|V| / 2$ times before the distance $d(s, u)$ would exceed $|V|$. Since there are at most $2|E|$ residual edges, the total number of augmentations across the entire algorithm is bounded by $\mathcal{O}(|V| \times |E|)$. Each BFS takes $\mathcal{O}(|E|)$ time, yielding total time $\mathcal{O}(|V| \times |E|^2)$.

### Q13: Explain how the residual graph and reverse edges work in flow augmentation.
**Answer:**
For each edge $(u, v)$ with capacity $c$ carrying flow $f$:
- The **forward residual edge** has remaining capacity $c_f(u, v) = c(u, v) - f(u, v)$.
- The **reverse residual edge** $(v, u)$ has residual capacity $c_f(v, u) = f(u, v)$.
If a subsequent augmenting path traverses $(v, u)$, pushing flow along it decreases $f(u, v)$. This is mathematically equivalent to "undoing" or rerouting earlier sub-optimal flow allocations without needing backtracking or combinatorial search.

### Q14: How does the Widest-Path heuristic work, and what data structure does it use?
**Answer:**
Instead of finding the shortest path by edge count, Widest Path selects the path with the **maximum bottleneck capacity** $\delta$ in each iteration. It uses a modified Dijkstra's algorithm where the distance label is width:
$$\text{width}(v) = \max_{(u, v) \in E_f} \min(\text{width}(u), c_f(u, v))$$
Our implementation uses a custom binary max-heap (`PriorityQueue` in `js/model/priority-queue.js`) with $\mathcal{O}(\log |V|)$ insertion and extract-max operations, resulting in $\mathcal{O}(|E| \log |V|)$ per path search.

### Q15: What is the space complexity of the implementation, and why?
**Answer:**
The space complexity is **$\mathcal{O}(|V| + |E|)$**:
- Graph storage: Adjacency list using nested JavaScript `Map` objects storing $|V|$ vertices and $2|E|$ forward/reverse `Edge` instances.
- BFS/DFS structures: Queue/recursion stack and `visited` set of size at most $|V|$.
- Cytoscape visualization: DOM elements proportional to $|V| + |E|$.

### Q16: Can Ford-Fulkerson fail to terminate or fail to find the maximum flow?
**Answer:**
- If capacities are **rational numbers** (or integers), Ford-Fulkerson is guaranteed to terminate because every augmentation increases total flow by at least $1 / D$, where $D$ is the common denominator.
- If capacities are **irrational numbers** and arbitrary paths are chosen via DFS, Ford-Fulkerson can enter an infinite sequence of augmentations that converges to a value strictly less than the true maximum flow. Edmonds-Karp (BFS) avoids this entirely and always terminates correctly on real capacities.

### Q17: What is the complexity of one augmenting path search versus the complete max-flow algorithm?
**Answer:**
- One augmenting path search using BFS or DFS takes **$\mathcal{O}(|V| + |E|)$** (or $\mathcal{O}(|E| \log |V|)$ for widest path).
- The complete maximum-flow algorithm repeats this search until no augmenting path remains:
  - Edmonds-Karp: $\mathcal{O}(|V| \times |E|)$ augmentations $\times \mathcal{O}(|E|)$ = **$\mathcal{O}(|V| \times |E|^2)$**.
  - Ford-Fulkerson (DFS): $\mathcal{O}(|F|)$ augmentations $\times \mathcal{O}(|E|)$ = **$\mathcal{O}(|E| \times |F|)$**.

---

## Category 4: Minimum Cut & Algorithmic Correctness

### Q18: What is an $s-t$ cut, and how is its capacity defined?
**Answer:**
An $s-t$ cut is a partition of the vertices $V$ into two disjoint subsets $S$ and $T$ such that the source $s \in S$ and the sink $t \in T$ ($T = V \setminus S$).
The **capacity of the cut**, denoted $C(S, T)$, is the sum of the original capacities of all directed edges originating in $S$ and terminating in $T$:
$$C(S, T) = \sum_{u \in S, v \in T, (u, v) \in E} c(u, v)$$
Crucially, edges pointing from $T$ back to $S$ do not contribute to the cut capacity.

### Q19: State the Maximum Flow–Minimum Cut Theorem.
**Answer:**
In any flow network, the following three conditions are logically equivalent:
1. A flow $f$ is a maximum flow.
2. The residual network $G_f$ contains no augmenting paths from $s$ to $t$.
3. The value of the maximum flow $|f|$ equals the capacity of the minimum cut $C(S, T)$:
   $$|f|_{\max} = \min_{(S, T)} C(S, T)$$

### Q20: How does your code programmatically extract the minimum cut after finding maximum flow?
**Answer:**
In `FlowNetwork.findMinCut(source)` (`js/model/max-flow.js`):
1. Execute a traversal (DFS or BFS) starting from source $s$ on the final residual graph $G_f$.
2. Traverse only edges with positive remaining residual capacity ($c_f(u, v) > 0$).
3. The set of all visited vertices forms the source-side partition $S$.
4. All unvisited vertices form the sink-side partition $T = V \setminus S$.
5. Inspect all original edges $(u, v)$ from the baseline graph: if $u \in S$ and $v \in T$ with capacity $c(u, v) > 0$, $(u, v)$ is a **minimum-cut edge**.
6. Summing the original capacities of these edges gives the total minimum-cut capacity, which is verified to equal the maximum flow.

### Q21: What are the verified maximum flow and minimum cut values for your three scenarios?
**Answer:**
| Scenario | Computed Max Flow | Computed Min-Cut Capacity | Verified Min-Cut Bottleneck Edges |
|---|---|---|---|
| **Scenario 1: Normal Operation** | **23 people/min** | **23 people/min** | `1->3` (8), `1->4` (7), `2->5` (8) |
| **Scenario 2: Blocked Staircase A** | **13 people/min** | **13 people/min** | `8->10` (3), `8->11` (3), `9->11` (7) |
| **Scenario 3: Restricted North Exit** | **14 people/min** | **14 people/min** | `8->11` (3), `9->11` (7), `10->12` (4) |
| **Generic 8-Node Example** | **11 flow units** | **11 capacity units** | `4->7` (7), `7->8` (4) |

In every case, $|f|_{\max} = C(S, T)$, rigorously confirming the Max-Flow Min-Cut theorem.

### Q22: What happens to the minimum cut if the network is completely disconnected?
**Answer:**
If no path exists between source $s$ and sink $t$, maximum flow is **0 people/min**. In the residual graph, $s$ cannot reach $t$, so $S$ contains only vertices reachable from $s$ in its component, and no edges with positive capacity cross from $S$ to $T$. Thus, minimum-cut capacity is **0**, and the application displays an explicit "Network Disconnected" alert.

---

## Category 5: Evacuation Scenarios & Comparative Analysis

### Q23: Why does blocking Staircase A reduce building throughput from 23 to 13 people/min?
**Answer:**
In Normal Operation, Staircase A (`5->7`, capacity 10) feeds directly into North Exit (`7->10`, capacity 10), providing a dedicated high-capacity pathway out of the building.
When Staircase A is blocked (capacity 0):
- People from Room 101 and Junction A are forced to divert into the narrow Main Corridor (`5->8`, capacity 4).
- The Main Corridor now must handle evacuees from both Junction A and Junction B, but its total discharge capacity into exits is only 6 (3 to North Exit, 3 to South Exit).
- Combined with Staircase B (`9->11`, capacity 7), the maximum flow across the bottleneck drops to:
  $$3 + 3 + 7 = 13 \text{ people/minute}$$
  This is a **10 people/min (43.5%) reduction** in total evacuation capacity.

### Q24: What bottleneck occurs in Scenario 3: Restricted North Exit?
**Answer:**
Heavy debris/smoke restricts the final doorway at North Exit (`10->12`) from 13 down to 4 people/min.
Even though Staircase A and the Main Corridor can deliver up to 13 people/min to the North Exit foyer, the doorway restricts egress to 4. Occupants cannot safely bypass to South Exit because corridor edges are directed.
The total flow is bounded by:
$$\text{North Doorway (4)} + \text{South Exit discharge (10)} = 14 \text{ people/minute}$$
This represents a **9 people/min (39.1%) capacity reduction**.

### Q25: How are Percentage Reduction and Signed Percentage Change distinguished in the UI?
**Answer:**
To avoid mathematical sign confusion:
- **Capacity Reduction (positive magnitude):** Measures the deficit from baseline:
  $$\text{Reduction} = F_{\text{baseline}} - F_{\text{scenario}} = 23 - 13 = 10 \text{ people/min}$$
  $$\text{Percentage Reduction} = \left(\frac{10}{23}\right) \times 100 \approx 43.5\%$$
- **Absolute Change / Signed Change (signed magnitude):** Measures relative change:
  $$\Delta F = F_{\text{scenario}} - F_{\text{baseline}} = 13 - 23 = -10 \text{ people/min}$$
  $$\text{Signed Percentage Change} = \left(\frac{-10}{23}\right) \times 100 \approx -43.5\%$$
- A division-by-zero guard ensures that if baseline flow is 0, the percentage safely renders as `0.0%`.

### Q26: What is "Baseline Immutability" and why is it essential?
**Answer:**
The baseline network (Normal Operation, 23 people/min) must remain completely invariant in memory (`EVACUATION_BASELINE_EDGES` and `EVACUATION_BASELINE_NODES` are immutable constants). Each scenario clones the baseline and applies its specific modifications. When switching scenarios or resetting analysis, pristine clones are generated so that restrictions or flow saturation from previous tests never contaminate subsequent calculations.

---

## Category 6: Implementation Architecture & Testing

### Q27: How does the UI state machine operate, and what was the `exitManualPracticeMode()` fix?
**Answer:**
The original application uses a four-state finite state machine:
`GRAPH_CREATION` $\to$ `SELECT_PATH` $\to$ `CHOOSE_FLOW` $\to$ `UPDATE_RESIDUAL_GRAPH` $\to$ `SELECT_PATH`...
**The Bug:** In Phase 2, if a user started manual practice and then selected an automated scenario or clicked "Run Analysis", stale practice DOM elements (selected path text, confirm buttons, finalization sidebar) remained visible on top of the automated dashboard.
**The Fix:** We implemented `exitManualPracticeMode(restoreOriginalGraph)`:
- Hides the practice sidebar (`#finalization-block`) and restores canvas layout width (`col-lg-10`).
- Resets button labels to `"Start Practice"`.
- Resets the state machine to `GRAPH_CREATION`.
- Clears selected path arrays and DOM history.
- If called with `true` (Start Over), cleanly restores the graph from `originalFlowNetwork`.

### Q28: How is node layout preserved when switching scenarios or running algorithms?
**Answer:**
Cytoscape defaults to dynamic force-directed layouts (like CoSE or concentric) which re-randomize positions whenever elements are replaced.
In `js/evacuation-scenarios.js`, `EVACUATION_PRESET_POSITIONS` defines fixed Cartesian coordinates $(x, y)$ for each room, junction, staircase, and exit. When a scenario loads or resets, `restoreEvacuationLayout(cy)` assigns these exact positions to each node, ensuring the spatial mental map of the building remains completely steady.

### Q29: Describe the automated test suite in `tests/` and how it verifies the application.
**Answer:**
The test suite consists of three modular files run via Node.js:
1. `tests/test-flow-network.js` (12 tests):
   - Single edge, parallel paths, shared bottleneck.
   - Reverse-edge rerouting verification.
   - Disconnected network and zero-capacity edges.
   - Malformed input (self-loops, isolated vertices).
   - Generic 8-node example regression (11 units).
   - Scenarios 1, 2, and 3 max-flow and min-cut computation.
   - Edmonds-Karp vs Widest-Path consistency check.
2. `tests/test-scenarios-and-ui.js` (9 tests):
   - Baseline comparison metrics and % convention.
   - Baseline immutability and preset coordinate preservation.
   - Continuous 5-round scenario switching cycles without edge/capacity leaks.
   - UI state machine practice-mode exit and Run Analysis synchronization.
   - Reset Analysis restoring pristine graph state.
   - Generic Example switching and Start Over snapshot preservation.
3. `tests/run-all-tests.js`:
   - Master test runner executing both suites with 100% pass verification (21/21 tests passing in ~0.25s).

### Q30: What are the main limitations of the current implementation, and what would be the next engineering extension?
**Answer:**
**Current Limitations:**
1. Constant capacities: Does not model dynamic bottleneck propagation where high crowd density causes crowd compression and reduces walking speed.
2. Static single-source/sink: Multiple distinct exits are linked into a single exterior supersink rather than modeling individual route preference choices.
3. No temporal simulation: Analyzes instantaneous capacity throughput (people/min), not evacuation time in seconds.
**Future Scope:**
- Integration of a dynamic flow-over-time model (Ford-Fulkerson time-expanded graphs).
- Real-time agent-based simulation overlaid on the network graph.
- Multi-commodity flow where occupants have distinct exit evacuation priorities.
