# Algorithmic Complexity Analysis

**Project Title:** Graph-Based Emergency Evacuation Capacity Optimization Using Maximum Flow and Minimum Cut Algorithms
**Application Name:** Campus Evacuation Capacity Analyzer
**Course:** Design and Analysis of Algorithms (DAA)
**Implementation Source:** `js/model/flow-solvers.js`, `js/model/max-flow.js`, `js/model/priority-queue.js`, `js/evacuation-scenarios.js`

---

## 1. Graph Representation & Data Structures

In our implementation (`FlowNetwork` class in `js/model/max-flow.js`), the network is stored using an adjacency list model backed by JavaScript ES6 `Map` objects:

```javascript
class FlowNetwork {
  constructor(source, sink) {
    this.graph = new Map(); // Map<VertexID, Map<NeighborID, Edge>>
    this.source = source;
    this.sink = sink;
  }
}
```

### Vertex and Edge Definitions
- **$V$ (Vertices):** Total number of nodes (in our baseline evacuation model, $|V| = 12$).
- **$E$ (Edges):** Total number of directed edges (in our baseline evacuation model, $|E| = 17$).
- **Residual Edges:** For each directed edge $(u, v)$ with capacity $c(u, v)$, an initial forward edge with capacity $c(u, v)$ and flow $0$ is added, and a reverse edge $(v, u)$ with capacity $0$ is automatically created.
- **Neighbor Access:** Finding neighbors of vertex $u$ requires `this.graph.get(u)`, which operates in $O(1)$ average time via hashing. Iterating over outgoing edges of $u$ takes $O(\text{deg}^+(u))$ time.

---

## 2. Path-Finding Subroutines (Single Augmentation)

Before analyzing complete maximum-flow algorithms, we analyze the time complexity of finding a single augmenting path from source $s$ to sink $t$ in the residual graph $G_f$.

### 2.1 Breadth-First Search (BFS) — Shortest Augmenting Path
- **Method:** `FlowNetwork.findShortestAugmentingPath()`
- **Mechanism:** Standard FIFO queue exploration. Traverses vertices and edges where residual capacity $c_f(u, v) = c(u, v) - f(u, v) > 0$.
- **Path Guarantee:** Finds an augmenting path with the **minimum number of edges**.
- **Time Complexity:**
  $$\mathcal{O}(|V| + |E|)$$
  Every reachable vertex is enqueued at most once, and every incident residual edge is examined at most once.
- **Auxiliary Space:** $\mathcal{O}(|V|)$ to store the queue, `visited` set, and `prev` predecessor map.

### 2.2 Depth-First Search (DFS) — Randomized Augmenting Path
- **Method:** `FlowNetwork.findRandomAugmentingPath()`
- **Mechanism:** Randomized recursive DFS with a Fisher-Yates shuffle on outgoing edges at each node.
- **Path Guarantee:** Arbitrary simple path; does not guarantee shortest length or widest bottleneck.
- **Time Complexity:**
  $$\mathcal{O}(|V| + |E|)$$
  Visits each reachable vertex and edge at most once during a single traversal.
- **Auxiliary Space:** $\mathcal{O}(|V|)$ call-stack recursion depth and visited tracking.

### 2.3 Modified Dijkstra — Widest Augmenting Path (Maximum Bottleneck)
- **Method:** `FlowNetwork.findWidestAugmentingPath()`
- **Mechanism:** Priority-queue-driven greedy exploration maximizing the bottleneck width:
  $$\text{width}(v) = \max_{(u, v) \in E_f} \min(\text{width}(u), c_f(u, v))$$
- **Priority Queue Implementation:** `PriorityQueue` (`js/model/priority-queue.js`) uses an array-based binary max-heap with 1-based indexing (`push`, `pop`, `sinkDown`, `bubbleUp`).
  - Heap `push`: $\mathcal{O}(\log |V|)$
  - Heap `pop` (extract-max): $\mathcal{O}(\log |V|)$
- **Time Complexity for a Single Widest Path:**
  $$\mathcal{O}(|E| \log |V|)$$
  In the worst case, each residual edge relaxation inserts an element into the binary heap, and each vertex is extracted with $\mathcal{O}(\log |V|)$ heap adjustments.
- **Auxiliary Space:** $\mathcal{O}(|V|)$ for the heap and distance/predecessor maps.

---

## 3. Complete Maximum-Flow Algorithms

A maximum-flow algorithm repeatedly executes augmenting path searches until no path with positive residual capacity exists from $s$ to $t$.

### 3.1 Ford-Fulkerson Method (Arbitrary Augmenting Paths)
- **Algorithm Type:** Augmenting path method using arbitrary paths (implemented via iterative deterministic DFS in `solveFordFulkerson`).
- **Termination & Bounds (Standard Integer Capacity Analysis):**
  If capacities are integers, each augmentation increases total flow by at least $1$ integer unit ($\delta \ge 1$).
  Therefore, the algorithm terminates in at most $|F|$ augmentations, where $|F|$ is the numerical value of the maximum flow.
- **Total Worst-Case Time Complexity:**
  $$\mathcal{O}(|E| \times |F|)$$
- **Crucial Implementation Assumptions & Qualifications:**
  - **Pseudo-polynomial nature:** The $\mathcal{O}(|E| \times |F|)$ bound depends on the numerical value of the maximum flow $|F|$, rather than purely the input size ($|V|, |E|$).
  - **Capacity domain assumptions:**
    - *Integer capacities:* Guaranteed finite termination in at most $|F|$ iterations.
    - *Rational capacities:* If capacities are expressed as fractions $p/q$, multiplying by the least common multiple of denominators $D$ reduces the problem to integers, yielding $\mathcal{O}(|E| \times D \times |F|)$.
    - *Irrational / real-valued capacities:* Pathological networks can lead to infinite non-converging loops. In our hardened implementation, practical termination is strictly guaranteed by an explicit `maxIterations = 10000` guard and a floating-point tolerance threshold $\epsilon = 10^{-9}$.
  - **Pathological DFS alternation:** On graphs with high capacity outer edges and a unit-capacity bridge, naive DFS may alternate across the bridge, taking $2|F|$ iterations.

### 3.2 Edmonds-Karp Algorithm (BFS Augmenting Paths)
- **Algorithm Type:** Breadth-First Search augmenting paths (shortest path in terms of edge count).
- **Used by:** Automated Evacuation Solver (`runAutomatedAnalysis()` in `js/evacuation-scenarios.js`) and `solveEdmondsKarp()` in `js/model/flow-solvers.js`.
- **Theoretical Guarantee:** Independent of edge capacities $|F|$. Strongly polynomial.
- **Augmentation Bound Proof Sketch:**
  1. For all vertices $v \in V$, the shortest-path distance $d_{G_f}(s, v)$ in the residual network increases monotonically with each augmentation ($d_{new}(s, v) \ge d_{old}(s, v)$).
  2. An edge $(u, v)$ becomes the bottleneck (critical edge) during an augmentation when $c_f(u, v) = \delta$. It is saturated and removed from $G_f$.
  3. Before $(u, v)$ can become critical again, flow must be pushed backwards along $(v, u)$, which requires $d(s, v)$ to increase by at least $2$.
  4. Since $d(s, u) \le |V| - 2$, any single directed edge can become critical at most $\frac{|V|}{2}$ times.
  5. With $2|E|$ directed residual edges, the total number of augmentations across the entire execution is strictly bounded by:
     $$\text{Number of augmentations} \le |V| \times |E|$$
- **Total Worst-Case Time Complexity:**
  $$\mathcal{O}(|V| \times |E|^2)$$
  Each augmentation takes $\mathcal{O}(|E|)$ via BFS.
  Multiplying $\mathcal{O}(|V| \times |E|)$ augmentations by $\mathcal{O}(|E|)$ per BFS yields $\mathcal{O}(|V| \times |E|^2)$.
- **Performance on Campus Evacuation Graph:**
  For our college evacuation network ($|V| = 12$, $|E| = 17$):
  $$|V| \times |E|^2 = 12 \times 289 = 3,468 \text{ operations (worst-case upper bound)}$$
  In practice, the baseline evacuation network terminates in exactly **4 augmenting paths**, taking **$< 1$ millisecond** in JavaScript.

### 3.3 Widest-Path Heuristic (Fat-Path / Maximum-Capacity Augmentations)
- **Algorithm Type:** Selects the path that maximizes the bottleneck capacity $\delta$ in each iteration (modified Dijkstra in `solveWidestPath`).
- **Binary Heap Priority Queue Search Cost:**
  - Our heap implementation (`_makeMaxHeap`) does not maintain back-pointers for $\mathcal{O}(\log |V|)$ `decrease-key`. Instead, when a wider bottleneck to a node $v$ is discovered, the updated `(width, node)` pair is inserted into the binary heap.
  - In the worst case, each residual edge relaxation pushes an element into the heap, resulting in at most $\mathcal{O}(|E|)$ elements pushed and popped.
  - Stale heap entries are lazily discarded in $\mathcal{O}(1)$ via `if (width < maxWidth.get(u)) continue`.
  - Thus, a single search takes $\mathcal{O}(|E| \log |V|)$ time and $\mathcal{O}(|E|)$ auxiliary heap space.
- **Number of Augmentations Bound:**
  - By the Max-Flow Min-Cut theorem, the maximum bottleneck path carries at least $\frac{1}{|E|}$ fraction of the remaining unrouted flow:
    $$\delta \ge \frac{|F| - |f|}{|E|}$$
  - After $k$ augmentations, the remaining flow is bounded by $|F|(1 - 1/|E|)^k \le |F| e^{-k / |E|}$.
  - For integer capacities bounded by $C = \max_{(u, v)} c(u, v)$ or maximum flow $|F|$, the residual flow drops below $1$ unit after:
    $$\mathcal{O}(|E| \ln |F|) \quad \text{or} \quad \mathcal{O}(|E| \ln(|E| \times C))$$
    augmentations.
- **Total Time Complexity:**
  $$\mathcal{O}(|E| \log |V|) \times \mathcal{O}(|E| \log |F|) = \mathcal{O}(|E|^2 \log |V| \log |F|)$$
  - *Weakly polynomial:* Scales logarithmically with the flow capacity $|F|$ or maximum edge capacity $C$, providing rapid convergence when capacities are very large and BFS requires numerous small-unit augmentations.

---

## 4. Minimum-Cut Extraction Complexity

Once maximum flow is established and no augmenting paths remain in $G_f$:

### 4.1 Reachability Partitioning ($S$-Cut)
- **Method:** `FlowNetwork.findMinCut(source)`
- **Implementation:** Executes a single DFS/BFS from source $s$ on the residual graph $G_f$, including only edges $(u, v)$ with positive residual capacity ($c_f(u, v) > 0$).
- **Time Complexity:**
  $$\mathcal{O}(|V| + |E|)$$
- **Result:** Partition $S = \{v \in V \mid v \text{ is reachable from } s \text{ in } G_f\}$, and $T = V \setminus S$.

### 4.2 Cut Edge Identification & Bottleneck Capacity
- **Implementation:** Inspects original edge list $E$. An edge $(u, v) \in E$ is a minimum-cut edge if and only if:
  $$u \in S \quad \land \quad v \notin S \quad \land \quad c(u, v) > 0$$
- **Time Complexity:**
  Iterating over all original edges takes $\mathcal{O}(|E|)$ time with $\mathcal{O}(1)$ average set lookup for `reachableNodes.has(u)`.
- **Total Minimum-Cut Computation Time:**
  $$\mathcal{O}(|V| + |E|) + \mathcal{O}(|E|) = \mathcal{O}(|V| + |E|)$$
  Extracting the minimum cut adds negligible overhead compared to the flow computation.

---

## 5. Space (Memory) Complexity Analysis

| Component | Data Structure | Space Complexity |
|---|---|---|
| **Graph Adjacency List** | Nested ES6 `Map<VertexID, Map<NeighborID, Edge>>` | $\mathcal{O}(\|V\| + \|E\|)$ |
| **Residual Edges** | Forward + Reverse `Edge` instances ($2\|E\|$ edges) | $\mathcal{O}(\|E\|)$ |
| **BFS/DFS Exploration** | Queue/Recursion stack, `visited` Set, `prev` Map | $\mathcal{O}(\|V\|)$ |
| **Widest Path Priority Queue** | Binary heap array `pq` | $\mathcal{O}(\|V\|)$ |
| **Cytoscape DOM / State Store** | Cytoscape.js model representation | $\mathcal{O}(\|V\| + \|E\|)$ |
| **Original Snapshot** | `originalFlowNetwork` array of edge snapshots | $\mathcal{O}(\|E\|)$ |
| **Total Memory Overhead** | Linear in graph size | $\mathbf{\mathcal{O}(\|V\| + \|E\|)}$ |

Because the evacuation graph is sparse ($|E| \ll |V|^2$), the adjacency-list representation requires minimal memory (less than a few hundred kilobytes total in the browser heap).

---

## 6. Complexity Summary Table

| Phase / Operation | Algorithm / Subroutine | Time Complexity | Space Complexity | Practical Campus Model Runtime ($V=12, E=17$) |
|---|---|---|---|---|
| Single Augmenting Path (BFS) | Edmonds-Karp Subroutine | $\mathcal{O}(\|V\| + \|E\|)$ | $\mathcal{O}(\|V\|)$ | $< 0.1\text{ ms}$ |
| Single Augmenting Path (DFS) | Ford-Fulkerson Subroutine | $\mathcal{O}(\|V\| + \|E\|)$ | $\mathcal{O}(\|V\|)$ | $< 0.1\text{ ms}$ |
| Single Augmenting Path (Widest) | Dijkstra + Binary Heap | $\mathcal{O}(\|E\| \log \|V\|)$ | $\mathcal{O}(\|V\|)$ | $< 0.2\text{ ms}$ |
| Full Max-Flow (Edmonds-Karp) | BFS loop until no augmenting path | $\mathcal{O}(\|V\| \times \|E\|^2)$ | $\mathcal{O}(\|V\| + \|E\|)$ | $< 1\text{ ms}$ (4 augmentations) |
| Full Max-Flow (Ford-Fulkerson) | Arbitrary DFS augmentations | $\mathcal{O}(\|E\| \times \|F\|)$ *(pseudo-polynomial)* | $\mathcal{O}(\|V\| + \|E\|)$ | $< 1\text{ ms}$ (integer capacities) |
| Full Max-Flow (Widest Path) | Fat-path augmentations | $\mathcal{O}(\|E\|^2 \log \|V\| \log \|F\|)$ | $\mathcal{O}(\|V\| + \|E\|)$ | $< 1\text{ ms}$ |
| Minimum-Cut Extraction | Residual DFS reachability from $s$ | $\mathcal{O}(\|V\| + \|E\|)$ | $\mathcal{O}(\|V\|)$ | $< 0.1\text{ ms}$ |
| Bottleneck Edge Filtering | $u \in S, v \notin S$ partition check | $\mathcal{O}(\|E\|)$ | $\mathcal{O}(\|E\|)$ | $< 0.05\text{ ms}$ |

---

## 7. Standalone Solvers & Predecessor Tracking (Phase 5: `flow-solvers.js`)

In Phase 5, the three standalone solvers (`solveEdmondsKarp`, `solveFordFulkerson`, `solveWidestPath`) were implemented in `js/model/flow-solvers.js` with pure-algorithmic optimizations:

### 7.1 Predecessor Maps vs. Path Cloning
- **Previous Pattern:** Explorations previously duplicated paths on every branch via `structuredClone(path)`, incurring $\mathcal{O}(L \cdot |E|)$ memory overhead where $L$ is path length.
- **Phase 5 Implementation:** Solvers maintain a single predecessor map (`Map<nodeId, { prevNode, slotKey }>`). Each explored edge records its predecessor in $\mathcal{O}(1)$ time. Once sink $t$ is reached, the path is reconstructed in $\mathcal{O}(L)$ time via `_traceAndBottleneck(pred, src, snk, residual)`.
- **Space Overhead:** Strictly $\mathcal{O}(|V|)$ auxiliary space for predecessor mapping.

### 7.2 Collision-Free Residual Graph Representation
- **Composite Edge Keys:** To handle parallel edges and bidirectional original connections without key overwrites, `buildResidualNetwork()` keys residual slots by `fwd:<edgeId>` and `rev:<edgeId>`.
- **Adjacency Structure:** `Map<nodeId, Map<slotKey, slot>>` allows direct $\mathcal{O}(1)$ neighbor iteration and reverse-edge flow cancellation (`slot.revNode`, `slot.revKey`).

### 7.3 Iterative DFS in Ford-Fulkerson
- **Mechanism:** `solveFordFulkerson()` uses an explicit stack rather than recursion, eliminating call stack limits for large graphs.
- **Determinism:** Traverses neighbors in predictable Map-insertion order, guaranteeing reproducible traces.

### 7.4 Standalone Max-Heap for Widest-Path
- **Implementation:** `_makeMaxHeap` implements an array-based binary max-heap with 0-based bitwise indexing (`(i << 1) + 1` for left child, `((i + 1) >>> 1) - 1` for parent).
- **Complexity:** Push and extract-max operations are guaranteed $\mathcal{O}(\log |V|)$ without external class dependencies.

### 7.5 Automated Correctness Verification (`verifySolverResult`)
- In Phase 5.1, `verifySolverResult(networkDef, result, options)` was hardened into an independent verification suite that checks **all 9 correctness invariants** using a documented floating-point tolerance $\epsilon = 10^{-9}$:
  1. **Capacity Constraints (`CHECK_1_CAPACITY_CONSTRAINTS`):** Every original edge satisfies $0 \le f(e) \le c(e)$.
  2. **Flow Conservation (`CHECK_2_FLOW_CONSERVATION`):** For every vertex $v \in V \setminus \{s, t\}$, incoming flow equals outgoing flow ($\sum f_{in}(v) = \sum f_{out}(v)$).
  3. **Net Terminal Flows (`CHECK_3_NET_TERMINAL_FLOW`):** Net source outflow and net sink inflow both equal reported maximum flow $|F|$.
  4. **Independent Residual Reachability (`CHECK_4_INDEPENDENT_RESIDUAL_REACHABILITY`):** The residual reachability set $S$ is recomputed independently from scratch using original edges and final flows (untrusted solver partition).
  5. **Residual Sink Unreachability (`CHECK_5_SINK_UNREACHABLE`):** The sink is unreachable from source in residual network ($t \notin S$).
  6. **Cut Partition Validity (`CHECK_6_CUT_PARTITION`):** $s \in S$ and $t \in T = V \setminus S$.
  7. **Cut Edges & Capacity (`CHECK_7_CUT_EDGES_AND_CAPACITY`):** Cut edges are original edges crossing from $S$ to $T$, and their capacities sum exactly to $c(S, T)$.
  8. **Max-Flow Min-Cut Theorem Equality (`CHECK_8_MAX_FLOW_MIN_CUT_EQUALITY`):** $|F| = c(S, T)$.
  9. **Augmentation Trace Validity (`CHECK_9_AUGMENTING_PATHS_VALIDITY`):** Every path trace is connected, has bottleneck $\delta > 0$, and cumulative bottlenecks equal $|F|$.
- Verification executes independently in $\mathcal{O}(|V| + |E|)$ time and $\mathcal{O}(|V| + |E|)$ auxiliary space.

### 7.6 Exhaustive Min-Cut Oracle (`exhaustiveMinCutOracle`)
- For small graphs ($|V| \le 16$), `exhaustiveMinCutOracle(networkDef)` iterates over all $2^{|V|-2}$ possible cuts $(S, T)$ with $s \in S, t \in T$, computing exact cut capacities directly from definition:
  $$c(S, T) = \sum_{u \in S, v \in T} c(u, v)$$
- Provides an independent benchmark oracle with time complexity $\mathcal{O}(2^{|V|-2} \cdot |E|)$, completely decoupled from any maximum-flow algorithm.

---

## 8. Standardized Metrics & Execution Tracing (Phase 6)

Phase 6 standardizes performance instrumentation and execution tracing across Edmonds-Karp, Ford-Fulkerson, and Widest-Path solvers to ensure reproducible metrics and transparent algorithmic diagnostics.

### 8.1 Metric Definitions & Counting Conventions

| Metric | Definition & Counting Rule | Normal Termination Relation |
|---|---|:---:|
| **`augmentations`** | Count of successful residual-path augmentations that strictly increase total flow by $\delta > 0$. | Exactly $k$ augmentations |
| **`searchAttempts`** | Count of all path-search attempts initiated by the solver, **including the final unsuccessful search** that proves optimality. | Exactly $k + 1$ attempts ($1$ for disconnected graphs) |
| **`edgeExaminations`** | Count of residual slots iterated in the inner loop of the search routine. Each visited residual slot counts as $1$ examination, including saturated edges ($c_f \le \epsilon$) and already-visited target nodes. | $\ge \text{searchAttempts}$ |
| **`initMs`** | Elapsed time in milliseconds spent validating inputs and building the collision-free residual network (`buildResidualNetwork()`). | Sub-millisecond ($< 0.1\text{ ms}$) |
| **`coreMs`** | Elapsed time in milliseconds spent in the path-search and flow-augmentation loop. | Measured via `performance.now()` |
| **`totalMs`** | End-to-end execution time including residual network initialization, augmentation loop, min-cut extraction, and invariant verification (`_finalise()`). | $\ge \text{initMs} + \text{coreMs}$ |
| **`elapsedMs`** | Backward-compatibility alias for `totalMs`. | Identical to `totalMs` |

### 8.2 High-Resolution Timing Engine
- High-resolution timing is implemented via `_now()`, prioritizing `globalThis.performance.now()` in browser and Node.js environments.
- Node.js fallback checks `require('perf_hooks').performance.now()`, and finally degrades to `Date.now()`.
- Avoids wall-clock time coarse-graining ($15\text{ ms}$ Windows tick resolution) by providing microsecond-precision profiling.

### 8.3 Step-Level Augmenting Path Tracing (`steps`)
Every record in `result.augmentingPaths` contains a detailed `steps` array describing each traversed edge in the augmenting path:
```javascript
{
  iteration: 1,
  path: "S->A->B->T",
  edgeIds: ["e1", "e3", "e5"],
  bottleneck: 1,
  totalFlow: 1,
  steps: [
    {
      edgeId: "e1",
      fromNode: "S",
      toNode: "A",
      isReverse: false,
      direction: "FORWARD_AUGMENTATION",
      residualCapBefore: 10,
      residualCapAfter: 9,
      bottleneck: 1
    },
    ...
  ]
}
```
- **Forward Augmentation vs. Reverse Cancellation:** Traversal along a forward edge has `isReverse: false` and `direction: 'FORWARD_AUGMENTATION'`. Traversal along a residual reverse edge has `isReverse: true` and `direction: 'REVERSE_CANCELLATION'`, making flow rerouting visually and programmatically transparent.
- **Residual Transitions:** For every step, $c_f^{\text{after}} = c_f^{\text{before}} - \delta$. At least one critical edge in each path transitions to $c_f^{\text{after}} = 0$ (saturation).
- **Automated Trace Verification:** `verifySolverResult` Check 9 independently checks path connectivity ($s \to \dots \to t$), step-to-step contiguity, bottleneck positivity, and residual capacity reduction.
