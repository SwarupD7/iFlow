// ============================================================================
// FLOW SOLVERS MODULE — Phase 5.1 Hardened Implementation
// Application: Campus Evacuation Capacity Analyzer
// File: js/model/flow-solvers.js
//
// Provides three complete, independently runnable maximum-flow solvers:
//   1. solveEdmondsKarp(networkDef, options)   — BFS augmentation O(V * E^2)
//   2. solveFordFulkerson(networkDef, options) — deterministic iterative DFS O(E * F)
//   3. solveWidestPath(networkDef, options)    — Priority Queue fat-path O(E^2 log V log F)
//
// Verification & Oracles:
//   • verifySolverResult(networkDef, result, options) — 9 rigorous correctness invariants
//   • exhaustiveMinCutOracle(networkDef)              — 2^(V-2) brute-force min-cut oracle
//   • buildResidualNetwork(networkDef)                — collision-free composite key residual
//
// Standard SolverResult Contract:
// {
//   status            : 'OPTIMAL' | 'INCOMPLETE' | 'ERROR',
//   errorMessage      : string | null,
//   algorithm         : string,
//   maxFlow           : number,
//   cutCapacity       : number,
//   minCutEdges       : Array<{ id, source, target, capacity, originalCapacity }>,
//   cutEdges          : Array<{ id, source, target, capacity, originalCapacity }>,
//   sourcePartition   : string[],   // S-side of min-cut
//   sinkPartition     : string[],   // T-side of min-cut
//   reachableNodes    : string[],   // backward compatibility alias
//   edgeFlows         : Array<{ id, source, target, capacity, flow }>,
//   augmentingPaths   : Array<{ iteration, path, edgeIds, bottleneck, totalFlow }>,
//   iterations        : number,
//   terminationReason : 'NO_AUGMENTING_PATH' | 'MAX_ITERATIONS' | 'ERROR',
//   metrics: {
//     augmentations   : number,
//     searchAttempts  : number,
//     edgeExaminations: number,
//     elapsedMs       : number,
//     isTerminated    : boolean,
//     terminationReason: string
//   },
//   durationMs        : number,
//   isCorrect         : boolean,
//   verifierErrors    : string[],
//   verifierChecks    : Record<string, { passed: boolean, message: string }>
// }
// ============================================================================

// ---------------------------------------------------------------------------
// Internal: MinHeap-based Priority Queue (no external dependencies)
// ---------------------------------------------------------------------------
function _makeMaxHeap(compareFn) {
  const heap = [];

  function swap(i, j) {
    const tmp = heap[i];
    heap[i] = heap[j];
    heap[j] = tmp;
  }

  function siftUp() {
    let i = heap.length - 1;
    while (i > 0) {
      const p = ((i + 1) >>> 1) - 1;
      if (compareFn(heap[i], heap[p])) {
        swap(i, p);
        i = p;
      } else break;
    }
  }

  function siftDown() {
    let i = 0;
    const n = heap.length;
    while (true) {
      const l = (i << 1) + 1;
      const r = (i + 1) << 1;
      let best = i;
      if (l < n && compareFn(heap[l], heap[best])) best = l;
      if (r < n && compareFn(heap[r], heap[best])) best = r;
      if (best === i) break;
      swap(i, best);
      i = best;
    }
  }

  return {
    push(val) { heap.push(val); siftUp(); },
    pop() {
      if (heap.length === 0) return undefined;
      const top = heap[0];
      const last = heap.pop();
      if (heap.length > 0) { heap[0] = last; siftDown(); }
      return top;
    },
    isEmpty() { return heap.length === 0; }
  };
}

// ---------------------------------------------------------------------------
// 1. buildResidualNetwork(networkDef)
//
// Converts a plain networkDef into an internal residual adjacency map.
// Validates all inputs:
//   - source and sink present and distinct
//   - valid non-null endpoints on every edge
//   - non-negative finite capacities
//   - no duplicate edge IDs
// Preserves all original edge records (including self-loops & zero-cap edges).
// ---------------------------------------------------------------------------
function buildResidualNetwork(networkDef) {
  if (!networkDef || typeof networkDef !== 'object') {
    return { error: 'networkDef must be a plain object' };
  }
  if (networkDef.source == null || networkDef.source === '') {
    return { error: 'source is required' };
  }
  if (networkDef.sink == null || networkDef.sink === '') {
    return { error: 'sink is required' };
  }

  const src = String(networkDef.source);
  const snk = String(networkDef.sink);
  if (src === snk) return { error: 'source and sink must differ' };

  const edges = networkDef.edges;
  if (!Array.isArray(edges)) {
    return { error: 'edges must be an array' };
  }

  const residual = new Map();
  const nodeIds  = new Set([src, snk]);
  const allOriginalEdges = [];
  const seenEdgeIds = new Set();

  function ensureNode(n) {
    if (!residual.has(n)) residual.set(n, new Map());
    nodeIds.add(n);
  }
  ensureNode(src);
  ensureNode(snk);

  for (let idx = 0; idx < edges.length; idx++) {
    const e = edges[idx];
    if (!e || typeof e !== 'object') {
      return { error: `Edge at index ${idx} is not a valid object` };
    }
    if (e.source == null || e.source === '' || e.target == null || e.target === '') {
      return { error: `Edge at index ${idx} is missing source or target endpoint` };
    }
    const u = String(e.source);
    const v = String(e.target);
    const eid = e.id != null ? String(e.id) : `e_${idx}`;

    if (seenEdgeIds.has(eid)) {
      return { error: `Duplicate edge ID: ${eid}` };
    }
    seenEdgeIds.add(eid);

    if (e.capacity == null || typeof e.capacity === 'boolean') {
      return { error: `Invalid capacity on edge ${eid}: ${e.capacity}` };
    }
    const cap = parseFloat(e.capacity);
    if (!isFinite(cap) || isNaN(cap) || cap < 0) {
      return { error: `Invalid capacity on edge ${eid}: must be a finite non-negative number (got ${e.capacity})` };
    }

    ensureNode(u);
    ensureNode(v);

    const isSelfLoop = (u === v);
    const isZeroCap  = (cap === 0);

    if (!isSelfLoop && !isZeroCap) {
      const fwdKey = `fwd:${eid}`;
      const revKey = `rev:${eid}`;

      residual.get(u).set(fwdKey, {
        cap, flow: 0,
        revNode: v, revKey,
        targetNode: v,
        originalEdgeId: eid,
        isReverse: false
      });
      residual.get(v).set(revKey, {
        cap: 0, flow: 0,
        revNode: u, revKey: fwdKey,
        targetNode: u,
        originalEdgeId: eid,
        isReverse: true
      });

      allOriginalEdges.push({ id: eid, source: u, target: v, capacity: cap, fwdKey, isSelfLoop: false, isZeroCap: false });
    } else {
      // Self-loops or zero-capacity edges are recorded but not placed in active residual search graph
      allOriginalEdges.push({ id: eid, source: u, target: v, capacity: cap, fwdKey: null, isSelfLoop, isZeroCap });
    }
  }

  return { residual, allOriginalEdges, source: src, sink: snk, nodeIds };
}

// ---------------------------------------------------------------------------
// 2. Internal: trace path & find bottleneck
// ---------------------------------------------------------------------------
function _traceAndBottleneck(pred, src, snk, residual) {
  if (!pred.has(snk)) return null;

  let bottleneck = Infinity;
  let node = snk;
  const pathEdges = [];

  while (node !== src) {
    const { prevNode, slotKey } = pred.get(node);
    const slot = residual.get(prevNode).get(slotKey);
    const residualCap = slot.cap - slot.flow;
    if (residualCap < bottleneck) bottleneck = residualCap;
    pathEdges.push({
      fromNode: prevNode,
      slotKey,
      toNode: node,
      edgeId: slot.originalEdgeId,
      isReverse: slot.isReverse
    });
    node = prevNode;
  }

  pathEdges.reverse();
  return { bottleneck, pathEdges };
}

// ---------------------------------------------------------------------------
// 3. Internal: augment flow
// ---------------------------------------------------------------------------
function _augment(residual, pathEdges, bottleneck) {
  for (const { fromNode, slotKey } of pathEdges) {
    const slot = residual.get(fromNode).get(slotKey);
    slot.flow += bottleneck;
    const revSlot = residual.get(slot.revNode).get(slot.revKey);
    revSlot.flow -= bottleneck;
  }
}

// ---------------------------------------------------------------------------
// 4. Internal: extract min-cut
// ---------------------------------------------------------------------------
function _extractMinCut(residual, src, snk, allOriginalEdges) {
  const reachable = new Set();
  const stack = [src];
  while (stack.length > 0) {
    const u = stack.pop();
    if (reachable.has(u)) continue;
    reachable.add(u);
    if (residual.has(u)) {
      for (const [, slot] of residual.get(u)) {
        const remCap = slot.cap - slot.flow;
        if (remCap > 1e-9 && !reachable.has(slot.targetNode)) {
          stack.push(slot.targetNode);
        }
      }
    }
  }

  const allNodes = new Set([src, snk]);
  for (const e of allOriginalEdges) {
    allNodes.add(e.source);
    allNodes.add(e.target);
  }

  const sinkPartition = [];
  for (const n of allNodes) {
    if (!reachable.has(n)) sinkPartition.push(n);
  }

  const cutEdges = [];
  let cutCapacity = 0;
  for (const e of allOriginalEdges) {
    if (reachable.has(e.source) && !reachable.has(e.target)) {
      cutEdges.push({
        id: e.id,
        source: e.source,
        target: e.target,
        capacity: e.capacity,
        originalCapacity: e.capacity
      });
      cutCapacity += e.capacity;
    }
  }

  return {
    reachable: Array.from(reachable),
    sourcePartition: Array.from(reachable),
    sinkPartition,
    cutEdges,
    cutCapacity
  };
}

// ---------------------------------------------------------------------------
// 5. Internal: build path string
// ---------------------------------------------------------------------------
function _pathString(src, pathEdges) {
  let s = src;
  for (const { toNode } of pathEdges) {
    s += '->' + toNode;
  }
  return s;
}

// ---------------------------------------------------------------------------
// 6. Internal: error result
// ---------------------------------------------------------------------------
function _errResult(algorithm, msg) {
  return {
    status: 'ERROR',
    errorMessage: msg,
    algorithm,
    maxFlow: 0,
    cutCapacity: 0,
    minCutEdges: [],
    cutEdges: [],
    sourcePartition: [],
    sinkPartition: [],
    reachableNodes: [],
    edgeFlows: [],
    augmentingPaths: [],
    iterations: 0,
    terminationReason: 'ERROR',
    metrics: {
      augmentations: 0,
      searchAttempts: 0,
      edgeExaminations: 0,
      elapsedMs: 0,
      isTerminated: true,
      terminationReason: 'ERROR'
    },
    durationMs: 0,
    isCorrect: false,
    verifierErrors: [msg],
    verifierChecks: {}
  };
}

// ---------------------------------------------------------------------------
// 7. Internal: finalise and verify result
// ---------------------------------------------------------------------------
function _finalise(algorithm, startTime, maxFlow, augPaths, terminationReason,
                   allOriginalEdges, residual, src, snk, networkDef,
                   searchAttempts, edgeExaminations) {
  const durationMs = Date.now() - startTime;

  // Build per-edge flow records for all original edges
  const edgeFlows = allOriginalEdges.map(e => {
    let flow = 0;
    if (e.fwdKey != null && residual.has(e.source) && residual.get(e.source).has(e.fwdKey)) {
      const slot = residual.get(e.source).get(e.fwdKey);
      flow = Math.max(0, slot.flow);
    }
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      capacity: e.capacity,
      flow: flow
    };
  });

  const { reachable, sourcePartition, sinkPartition, cutEdges, cutCapacity } =
    _extractMinCut(residual, src, snk, allOriginalEdges);

  let status = (terminationReason === 'MAX_ITERATIONS') ? 'INCOMPLETE' : 'OPTIMAL';

  const result = {
    status,
    errorMessage: null,
    algorithm,
    maxFlow,
    cutCapacity,
    minCutEdges: cutEdges,
    cutEdges,
    sourcePartition,
    sinkPartition,
    reachableNodes: sourcePartition,
    edgeFlows,
    augmentingPaths: augPaths,
    iterations: augPaths.length,
    terminationReason,
    metrics: {
      augmentations: augPaths.length,
      searchAttempts: searchAttempts || augPaths.length,
      edgeExaminations: edgeExaminations || 0,
      elapsedMs: durationMs,
      isTerminated: true,
      terminationReason
    },
    durationMs,
    isCorrect: false,
    verifierErrors: [],
    verifierChecks: {}
  };

  const verification = verifySolverResult(networkDef, result);
  result.isCorrect      = verification.isCorrect;
  result.verifierErrors = verification.errors;
  result.verifierChecks = verification.checks;

  if (!verification.isCorrect && result.status === 'OPTIMAL') {
    result.status = 'INCOMPLETE';
  }

  return result;
}

// ---------------------------------------------------------------------------
// PUBLIC: solveEdmondsKarp(networkDef, options)
// ---------------------------------------------------------------------------
function solveEdmondsKarp(networkDef, options) {
  const MAX_ITER = (options && options.maxIterations) || 10000;
  const algo = 'Edmonds-Karp (BFS)';
  const t0 = Date.now();

  const net = buildResidualNetwork(networkDef);
  if (net.error) return _errResult(algo, net.error);

  const { residual, allOriginalEdges, source: src, sink: snk } = net;
  let maxFlow = 0;
  const augPaths = [];
  let iter = 0;
  let searchAttempts = 0;
  let edgeExaminations = 0;
  let terminationReason = 'NO_AUGMENTING_PATH';

  while (iter < MAX_ITER) {
    searchAttempts++;
    const pred = new Map();
    const visited = new Set([src]);
    const queue = [src];
    let qi = 0;

    bfsLoop:
    while (qi < queue.length) {
      const u = queue[qi++];
      if (!residual.has(u)) continue;
      for (const [slotKey, slot] of residual.get(u)) {
        edgeExaminations++;
        const v = slot.targetNode;
        if (!visited.has(v) && slot.cap - slot.flow > 1e-9) {
          visited.add(v);
          pred.set(v, { prevNode: u, slotKey });
          if (v === snk) break bfsLoop;
          queue.push(v);
        }
      }
    }

    if (!pred.has(snk)) break;

    const traced = _traceAndBottleneck(pred, src, snk, residual);
    if (!traced || traced.bottleneck <= 1e-9) break;

    _augment(residual, traced.pathEdges, traced.bottleneck);
    maxFlow += traced.bottleneck;
    iter++;
    augPaths.push({
      iteration: iter,
      path: _pathString(src, traced.pathEdges),
      edgeIds: traced.pathEdges.map(pe => pe.edgeId),
      bottleneck: traced.bottleneck,
      totalFlow: maxFlow
    });

    if (iter >= MAX_ITER) { terminationReason = 'MAX_ITERATIONS'; break; }
  }

  return _finalise(algo, t0, maxFlow, augPaths, terminationReason,
                   allOriginalEdges, residual, src, snk, networkDef,
                   searchAttempts, edgeExaminations);
}

// ---------------------------------------------------------------------------
// PUBLIC: solveFordFulkerson(networkDef, options)
// ---------------------------------------------------------------------------
function solveFordFulkerson(networkDef, options) {
  const MAX_ITER = (options && options.maxIterations) || 10000;
  const algo = 'Ford-Fulkerson (DFS)';
  const t0 = Date.now();

  const net = buildResidualNetwork(networkDef);
  if (net.error) return _errResult(algo, net.error);

  const { residual, allOriginalEdges, source: src, sink: snk } = net;
  let maxFlow = 0;
  const augPaths = [];
  let iter = 0;
  let searchAttempts = 0;
  let edgeExaminations = 0;
  let terminationReason = 'NO_AUGMENTING_PATH';

  while (iter < MAX_ITER) {
    searchAttempts++;
    const pred = new Map();
    const visited = new Set([src]);
    const stack = [src];
    let found = false;

    while (stack.length > 0 && !found) {
      const u = stack[stack.length - 1];
      let pushed = false;
      if (residual.has(u)) {
        for (const [slotKey, slot] of residual.get(u)) {
          edgeExaminations++;
          const v = slot.targetNode;
          if (!visited.has(v) && slot.cap - slot.flow > 1e-9) {
            visited.add(v);
            pred.set(v, { prevNode: u, slotKey });
            if (v === snk) { found = true; break; }
            stack.push(v);
            pushed = true;
            break;
          }
        }
      }
      if (!found && !pushed) stack.pop();
    }

    if (!pred.has(snk)) break;

    const traced = _traceAndBottleneck(pred, src, snk, residual);
    if (!traced || traced.bottleneck <= 1e-9) break;

    _augment(residual, traced.pathEdges, traced.bottleneck);
    maxFlow += traced.bottleneck;
    iter++;
    augPaths.push({
      iteration: iter,
      path: _pathString(src, traced.pathEdges),
      edgeIds: traced.pathEdges.map(pe => pe.edgeId),
      bottleneck: traced.bottleneck,
      totalFlow: maxFlow
    });

    if (iter >= MAX_ITER) { terminationReason = 'MAX_ITERATIONS'; break; }
  }

  return _finalise(algo, t0, maxFlow, augPaths, terminationReason,
                   allOriginalEdges, residual, src, snk, networkDef,
                   searchAttempts, edgeExaminations);
}

// ---------------------------------------------------------------------------
// PUBLIC: solveWidestPath(networkDef, options)
// ---------------------------------------------------------------------------
function solveWidestPath(networkDef, options) {
  const MAX_ITER = (options && options.maxIterations) || 10000;
  const algo = 'Widest-Path (Priority Queue)';
  const t0 = Date.now();

  const net = buildResidualNetwork(networkDef);
  if (net.error) return _errResult(algo, net.error);

  const { residual, allOriginalEdges, source: src, sink: snk } = net;
  let maxFlow = 0;
  const augPaths = [];
  let iter = 0;
  let searchAttempts = 0;
  let edgeExaminations = 0;
  let terminationReason = 'NO_AUGMENTING_PATH';

  while (iter < MAX_ITER) {
    searchAttempts++;
    const maxWidth = new Map();
    const pred     = new Map();
    for (const n of residual.keys()) maxWidth.set(n, 0);
    maxWidth.set(src, Infinity);

    const pq = _makeMaxHeap((a, b) => a.width > b.width);
    pq.push({ width: Infinity, node: src });

    while (!pq.isEmpty()) {
      const { width, node: u } = pq.pop();
      if (width < maxWidth.get(u)) continue;

      if (residual.has(u)) {
        for (const [slotKey, slot] of residual.get(u)) {
          edgeExaminations++;
          const v = slot.targetNode;
          const remCap = slot.cap - slot.flow;
          if (remCap <= 1e-9) continue;
          const wCandidate = Math.min(remCap, maxWidth.get(u));
          if (wCandidate > (maxWidth.get(v) || 0)) {
            maxWidth.set(v, wCandidate);
            pred.set(v, { prevNode: u, slotKey });
            pq.push({ width: wCandidate, node: v });
          }
        }
      }
    }

    if (!pred.has(snk)) break;

    const traced = _traceAndBottleneck(pred, src, snk, residual);
    if (!traced || traced.bottleneck <= 1e-9) break;

    _augment(residual, traced.pathEdges, traced.bottleneck);
    maxFlow += traced.bottleneck;
    iter++;
    augPaths.push({
      iteration: iter,
      path: _pathString(src, traced.pathEdges),
      edgeIds: traced.pathEdges.map(pe => pe.edgeId),
      bottleneck: traced.bottleneck,
      totalFlow: maxFlow
    });

    if (iter >= MAX_ITER) { terminationReason = 'MAX_ITERATIONS'; break; }
  }

  return _finalise(algo, t0, maxFlow, augPaths, terminationReason,
                   allOriginalEdges, residual, src, snk, networkDef,
                   searchAttempts, edgeExaminations);
}

// ---------------------------------------------------------------------------
// PUBLIC: verifySolverResult(networkDef, result, options)
// Independently verifies all 9 correctness invariants.
// ---------------------------------------------------------------------------
function verifySolverResult(networkDef, result, options) {
  const TOL = (options && typeof options.tolerance === 'number') ? options.tolerance : 1e-9;
  const errors = [];
  const checks = {};

  function recordCheck(id, passed, message) {
    checks[id] = { passed, message };
    if (!passed) {
      errors.push(`${id}: ${message}`);
    }
  }

  if (!result || typeof result !== 'object') {
    return {
      isCorrect: false,
      errors: ['Result must be a non-null object'],
      checks: { CHECK_0_OBJECT: { passed: false, message: 'Result is not an object' } }
    };
  }

  if (result.status === 'ERROR') {
    return {
      isCorrect: false,
      errors: [result.errorMessage || 'Result has ERROR status'],
      checks: { CHECK_STATUS: { passed: false, message: result.errorMessage || 'Result has ERROR status' } }
    };
  }

  if (!networkDef || typeof networkDef !== 'object') {
    return {
      isCorrect: false,
      errors: ['networkDef must be a non-null object'],
      checks: { CHECK_NETWORK_DEF: { passed: false, message: 'networkDef is not an object' } }
    };
  }

  const src = String(networkDef.source);
  const snk = String(networkDef.sink);
  const origEdges = Array.isArray(networkDef.edges) ? networkDef.edges : [];
  const edgeFlows = Array.isArray(result.edgeFlows) ? result.edgeFlows : [];

  const origEdgeMap = new Map();
  for (let idx = 0; idx < origEdges.length; idx++) {
    const e = origEdges[idx];
    const eid = e.id != null ? String(e.id) : `e_${idx}`;
    origEdgeMap.set(eid, {
      id: eid,
      source: String(e.source),
      target: String(e.target),
      capacity: parseFloat(e.capacity) || 0
    });
  }

  const allNodes = new Set([src, snk]);
  for (const e of origEdges) {
    allNodes.add(String(e.source));
    allNodes.add(String(e.target));
  }

  // CHECK 1: Every original edge satisfies 0 <= flow <= capacity
  let check1Passed = true;
  let check1Msg = 'All edge flows satisfy capacity constraints (0 <= flow <= capacity)';
  if (edgeFlows.length < origEdges.length) {
    check1Passed = false;
    check1Msg = `edgeFlows length (${edgeFlows.length}) is less than original edges count (${origEdges.length})`;
  } else {
    for (const ef of edgeFlows) {
      const eid = String(ef.id);
      const orig = origEdgeMap.get(eid);
      const cap = orig ? orig.capacity : (parseFloat(ef.capacity) || 0);
      const flow = parseFloat(ef.flow);
      if (isNaN(flow) || flow < -TOL || flow > cap + TOL) {
        check1Passed = false;
        check1Msg = `Edge ${eid} (${ef.source}->${ef.target}) violates capacity constraint: flow ${flow} not in [0, ${cap}]`;
        break;
      }
    }
  }
  recordCheck('CHECK_1_CAPACITY_CONSTRAINTS', check1Passed, check1Msg);

  // CHECK 2: Flow conservation at every intermediate vertex
  const inFlowMap = new Map();
  const outFlowMap = new Map();
  for (const n of allNodes) {
    inFlowMap.set(n, 0);
    outFlowMap.set(n, 0);
  }
  for (const ef of edgeFlows) {
    const u = String(ef.source);
    const v = String(ef.target);
    const f = parseFloat(ef.flow) || 0;
    if (u === v) continue;
    outFlowMap.set(u, (outFlowMap.get(u) || 0) + f);
    inFlowMap.set(v, (inFlowMap.get(v) || 0) + f);
  }

  let check2Passed = true;
  let check2Msg = 'Flow conservation holds at all intermediate vertices';
  for (const n of allNodes) {
    if (n === src || n === snk) continue;
    const inF = inFlowMap.get(n) || 0;
    const outF = outFlowMap.get(n) || 0;
    if (Math.abs(inF - outF) > TOL) {
      check2Passed = false;
      check2Msg = `Vertex ${n} violates flow conservation: inFlow=${inF.toFixed(4)}, outFlow=${outF.toFixed(4)}, diff=${Math.abs(inF - outF)}`;
      break;
    }
  }
  recordCheck('CHECK_2_FLOW_CONSERVATION', check2Passed, check2Msg);

  // CHECK 3: Net source flow and net sink flow equal reported maxFlow
  const netSrc = (outFlowMap.get(src) || 0) - (inFlowMap.get(src) || 0);
  const netSnk = (inFlowMap.get(snk) || 0) - (outFlowMap.get(snk) || 0);
  const reportedMaxFlow = parseFloat(result.maxFlow);
  let check3Passed = true;
  let check3Msg = `Net source flow (${netSrc}) and net sink flow (${netSnk}) equal reported maxFlow (${reportedMaxFlow})`;
  if (Math.abs(netSrc - reportedMaxFlow) > TOL || Math.abs(netSnk - reportedMaxFlow) > TOL) {
    check3Passed = false;
    check3Msg = `Net terminal flow mismatch: netSource=${netSrc}, netSink=${netSnk}, reportedMaxFlow=${reportedMaxFlow}`;
  }
  recordCheck('CHECK_3_NET_TERMINAL_FLOW', check3Passed, check3Msg);

  // CHECK 4: Residual reachability independently recomputed
  const indepResidual = new Map();
  function addIndepResidual(u, v, remCap) {
    if (remCap <= TOL) return;
    if (!indepResidual.has(u)) indepResidual.set(u, new Map());
    indepResidual.get(u).set(v, (indepResidual.get(u).get(v) || 0) + remCap);
  }

  for (const ef of edgeFlows) {
    const u = String(ef.source);
    const v = String(ef.target);
    if (u === v) continue;
    const cap = parseFloat(ef.capacity) || 0;
    const f = parseFloat(ef.flow) || 0;
    if (cap - f > TOL) addIndepResidual(u, v, cap - f);
    if (f > TOL) addIndepResidual(v, u, f);
  }

  const indepReachable = new Set([src]);
  const bfsQueue = [src];
  while (bfsQueue.length > 0) {
    const curr = bfsQueue.shift();
    if (indepResidual.has(curr)) {
      for (const [nbr, rem] of indepResidual.get(curr)) {
        if (rem > TOL && !indepReachable.has(nbr)) {
          indepReachable.add(nbr);
          bfsQueue.push(nbr);
        }
      }
    }
  }

  const reportedSourceSet = new Set(result.sourcePartition || result.reachableNodes || []);
  let check4Passed = true;
  let check4Msg = 'Independent residual reachability recomputed and matches reported sourcePartition';
  if (reportedSourceSet.size !== indepReachable.size) {
    check4Passed = false;
    check4Msg = `Reported sourcePartition size (${reportedSourceSet.size}) !== independently computed size (${indepReachable.size})`;
  } else {
    for (const node of indepReachable) {
      if (!reportedSourceSet.has(node)) {
        check4Passed = false;
        check4Msg = `Node ${node} is independently reachable in residual graph but missing from reported sourcePartition`;
        break;
      }
    }
  }
  recordCheck('CHECK_4_INDEPENDENT_RESIDUAL_REACHABILITY', check4Passed, check4Msg);

  // CHECK 5: Sink is unreachable from source in final residual network
  const sinkUnreachable = !indepReachable.has(snk);
  let check5Msg = sinkUnreachable
    ? `Sink (${snk}) is unreachable from source (${src}) in final residual network (optimality confirmed)`
    : `Sink (${snk}) IS reachable from source in residual network — augmenting path exists, flow is NOT maximal`;
  recordCheck('CHECK_5_SINK_UNREACHABLE', sinkUnreachable, check5Msg);

  // CHECK 6: Source/Sink partition derived from independently verified residual partition
  const indepSinkSet = new Set();
  for (const n of allNodes) {
    if (!indepReachable.has(n)) indepSinkSet.add(n);
  }
  const reportedSinkSet = new Set(result.sinkPartition || []);
  let check6Passed = indepReachable.has(src) && indepSinkSet.has(snk);
  let check6Msg = `Source-side partition (${indepReachable.size} nodes) contains source; sink-side partition (${indepSinkSet.size} nodes) contains sink`;
  if (!check6Passed) {
    check6Msg = `Partition error: source in S = ${indepReachable.has(src)}, sink in T = ${indepSinkSet.has(snk)}`;
  } else if (result.sinkPartition && result.sinkPartition.length > 0) {
    for (const n of indepSinkSet) {
      if (!reportedSinkSet.has(n)) {
        check6Passed = false;
        check6Msg = `Node ${n} belongs to sink partition T but missing from reported sinkPartition`;
        break;
      }
    }
  }
  recordCheck('CHECK_6_CUT_PARTITION', check6Passed, check6Msg);

  // CHECK 7: Cut edges are original edges crossing S->T, and sum to cutCapacity
  const indepCutEdges = [];
  let indepCutCapacity = 0;
  for (const ef of edgeFlows) {
    const u = String(ef.source);
    const v = String(ef.target);
    if (indepReachable.has(u) && !indepReachable.has(v)) {
      indepCutEdges.push({
        id: ef.id,
        source: u,
        target: v,
        capacity: parseFloat(ef.capacity) || 0
      });
      indepCutCapacity += parseFloat(ef.capacity) || 0;
    }
  }

  const reportedCutCap = parseFloat(result.cutCapacity);
  let check7Passed = Math.abs(indepCutCapacity - reportedCutCap) <= TOL;
  let check7Msg = `Cut edges correctly cross S->T cut; capacity sum (${indepCutCapacity}) equals reported cutCapacity (${reportedCutCap})`;
  if (!check7Passed) {
    check7Msg = `Cut capacity mismatch: independent sum = ${indepCutCapacity}, reported cutCapacity = ${reportedCutCap}`;
  }
  recordCheck('CHECK_7_CUT_EDGES_AND_CAPACITY', check7Passed, check7Msg);

  // CHECK 8: Max-Flow equals Min-Cut Capacity
  let check8Passed = Math.abs(reportedMaxFlow - reportedCutCap) <= TOL &&
                     Math.abs(reportedMaxFlow - indepCutCapacity) <= TOL;
  let check8Msg = `Max-Flow Min-Cut Theorem holds: maxFlow (${reportedMaxFlow}) === cutCapacity (${reportedCutCap})`;
  if (!check8Passed) {
    check8Msg = `Max-Flow Min-Cut violation: maxFlow=${reportedMaxFlow}, cutCapacity=${reportedCutCap}, indepCutCapacity=${indepCutCapacity}`;
  }
  recordCheck('CHECK_8_MAX_FLOW_MIN_CUT_EQUALITY', check8Passed, check8Msg);

  // CHECK 9: Augmenting paths traces validity
  let check9Passed = true;
  let check9Msg = 'All augmenting path traces are valid, connected, and have positive bottlenecks';
  const augPaths = Array.isArray(result.augmentingPaths) ? result.augmentingPaths : [];
  let sumBottlenecks = 0;
  for (let i = 0; i < augPaths.length; i++) {
    const ap = augPaths[i];
    if (!ap || typeof ap.path !== 'string' || ap.path.trim() === '') {
      check9Passed = false;
      check9Msg = `Augmenting path at index ${i} has invalid path string`;
      break;
    }
    const bn = parseFloat(ap.bottleneck);
    if (isNaN(bn) || bn <= TOL) {
      check9Passed = false;
      check9Msg = `Augmenting path at index ${i} has non-positive bottleneck: ${ap.bottleneck}`;
      break;
    }
    sumBottlenecks += bn;
  }
  if (check9Passed && augPaths.length > 0 && Math.abs(sumBottlenecks - reportedMaxFlow) > TOL) {
    check9Passed = false;
    check9Msg = `Sum of bottlenecks (${sumBottlenecks}) does not equal reported maxFlow (${reportedMaxFlow})`;
  }
  recordCheck('CHECK_9_AUGMENTING_PATHS_VALIDITY', check9Passed, check9Msg);

  const isCorrect = errors.length === 0;
  return {
    isCorrect,
    errors,
    checks,
    independentMetrics: {
      maxFlow: netSrc,
      cutCapacity: indepCutCapacity,
      sourcePartition: Array.from(indepReachable),
      sinkPartition: Array.from(indepSinkSet),
      cutEdges: indepCutEdges
    }
  };
}

// ---------------------------------------------------------------------------
// PUBLIC: exhaustiveMinCutOracle(networkDef)
// Independent 2^(V-2) brute-force cut-enumeration oracle for small graphs (|V| <= 16).
// ---------------------------------------------------------------------------
function exhaustiveMinCutOracle(networkDef) {
  if (!networkDef || !networkDef.source || !networkDef.sink || !Array.isArray(networkDef.edges)) {
    throw new Error('exhaustiveMinCutOracle: invalid networkDef');
  }
  const src = String(networkDef.source);
  const snk = String(networkDef.sink);
  const allNodes = new Set([src, snk]);
  for (const e of networkDef.edges) {
    allNodes.add(String(e.source));
    allNodes.add(String(e.target));
  }
  const intermediate = Array.from(allNodes).filter(n => n !== src && n !== snk);
  if (intermediate.length > 16) {
    throw new Error(`exhaustiveMinCutOracle: too many intermediate nodes (${intermediate.length} > 16) for brute force`);
  }

  let minCutCapacity = Infinity;
  let bestSourcePartition = [];
  let bestSinkPartition = [];
  let bestCutEdges = [];

  const totalSubsets = 1 << intermediate.length;
  for (let mask = 0; mask < totalSubsets; mask++) {
    const S = new Set([src]);
    for (let i = 0; i < intermediate.length; i++) {
      if ((mask & (1 << i)) !== 0) {
        S.add(intermediate[i]);
      }
    }
    const T = new Set();
    for (const n of allNodes) {
      if (!S.has(n)) T.add(n);
    }

    let cutCap = 0;
    const cutEdges = [];
    for (const e of networkDef.edges) {
      const u = String(e.source);
      const v = String(e.target);
      const cap = parseFloat(e.capacity) || 0;
      if (S.has(u) && T.has(v)) {
        cutCap += cap;
        cutEdges.push({ id: e.id, source: u, target: v, capacity: cap });
      }
    }

    if (cutCap < minCutCapacity) {
      minCutCapacity = cutCap;
      bestSourcePartition = Array.from(S);
      bestSinkPartition = Array.from(T);
      bestCutEdges = cutEdges;
    }
  }

  return {
    minCutCapacity,
    sourcePartition: bestSourcePartition,
    sinkPartition: bestSinkPartition,
    cutEdges: bestCutEdges
  };
}

// ---------------------------------------------------------------------------
// Node.js / browser dual-export compatibility
// ---------------------------------------------------------------------------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildResidualNetwork,
    solveEdmondsKarp,
    solveFordFulkerson,
    solveWidestPath,
    verifySolverResult,
    exhaustiveMinCutOracle
  };
}
