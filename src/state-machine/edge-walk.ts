/**
 * Edge-Covering Walk Algorithm
 *
 * Computes an ordered sequence of events (WalkStep[]) that covers every
 * transition (edge) in a state machine graph at least once. This guarantees
 * 100% transition coverage regardless of graph topology.
 *
 * Algorithm:
 * 1. Build adjacency list and edge universe (guarded transitions produce two edges)
 * 2. Precompute BFS shortest paths between all state pairs (for repositioning)
 * 3. Greedy DFS: at each state, prefer uncovered outgoing edges
 * 4. When stuck, insert repositioning steps to nearest state with uncovered edges
 * 5. Guard-fail steps don't advance state (guard blocks transition)
 *
 * Used by StateWalkEngine in @almadar-io/verify. Both orbital-verify and
 * runtime-verify share this algorithm for consistent coverage.
 *
 * @packageDocumentation
 */

import type { EdgeWalkTransition, WalkStep, StateEdge } from './types.js';
import { buildGuardPayloads } from './guard-payloads.js';

/**
 * Build an ordered walk that covers every edge in the state machine.
 *
 * @param transitions - All transitions in the state machine
 * @param initialState - Starting state
 * @returns Ordered walk steps covering every edge
 */
export function buildEdgeCoveringWalk(
  transitions: EdgeWalkTransition[],
  initialState: string,
): WalkStep[] {
  // 1. Build adjacency list, skip wildcards and INIT
  const filtered = transitions.filter(
    (t) => t.from !== '*' && t.event !== 'INIT',
  );

  const graph = new Map<string, Array<{ event: string; to: string; transition: EdgeWalkTransition }>>();
  const allStates = new Set<string>();

  for (const t of filtered) {
    allStates.add(t.from);
    allStates.add(t.to);
    if (!graph.has(t.from)) graph.set(t.from, []);
    graph.get(t.from)!.push({ event: t.event, to: t.to, transition: t });
  }

  // Ensure initial state is in the set
  allStates.add(initialState);

  // 2. Build edge universe. Guarded transitions produce pass + fail edges.
  const uncovered = new Set<string>();
  const edgeMeta = new Map<string, { transition: EdgeWalkTransition; guardCase: 'pass' | 'fail' | null }>();

  for (const t of filtered) {
    if (t.hasGuard) {
      const keyPass = `${t.from}+${t.event}->${t.to}[pass]`;
      const keyFail = `${t.from}+${t.event}->${t.to}[fail]`;
      uncovered.add(keyPass);
      uncovered.add(keyFail);
      edgeMeta.set(keyPass, { transition: t, guardCase: 'pass' });
      edgeMeta.set(keyFail, { transition: t, guardCase: 'fail' });
    } else {
      const key = `${t.from}+${t.event}->${t.to}`;
      uncovered.add(key);
      edgeMeta.set(key, { transition: t, guardCase: null });
    }
  }

  if (uncovered.size === 0) return [];

  // 3. Precompute BFS shortest paths between all state pairs
  const shortestPaths = new Map<string, Map<string, Array<{ event: string; to: string }>>>();
  for (const state of allStates) {
    shortestPaths.set(state, bfsShortestPaths(state, graph));
  }

  // 4. Greedy walk
  const walk: WalkStep[] = [];
  let currentState = initialState;
  const maxIterations = uncovered.size * allStates.size * 2; // safety bound
  let iterations = 0;

  while (uncovered.size > 0 && iterations < maxIterations) {
    iterations++;

    // Find uncovered edges from currentState
    const outgoing = findUncoveredEdges(currentState, graph, uncovered);

    if (outgoing.length > 0) {
      // Pick first uncovered edge
      const pick = outgoing[0];
      const payload = buildPayloadForEdge(pick.transition, pick.guardCase);

      walk.push({
        from: currentState,
        event: pick.transition.event,
        to: pick.transition.to,
        guardCase: pick.guardCase,
        payload,
        isRepositioning: false,
      });

      uncovered.delete(pick.key);

      // Guard-fail doesn't advance state
      if (pick.guardCase !== 'fail') {
        currentState = pick.transition.to;
      }
    } else {
      // Stuck: find nearest state with uncovered edges
      const target = findNearestUncoveredState(currentState, graph, uncovered, shortestPaths);

      if (!target) {
        // No reachable state with uncovered edges. Remaining edges are unreachable.
        break;
      }

      // Insert repositioning steps
      const repoPath = shortestPaths.get(currentState)?.get(target);
      if (!repoPath || repoPath.length === 0) break;

      for (const step of repoPath) {
        walk.push({
          from: currentState,
          event: step.event,
          to: step.to,
          guardCase: null,
          payload: {},
          isRepositioning: true,
        });
        currentState = step.to;
      }
    }
  }

  return walk;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * BFS from a source state, returning shortest paths to all reachable states.
 * Each path is an array of {event, to} steps.
 */
function bfsShortestPaths(
  source: string,
  graph: Map<string, Array<{ event: string; to: string; transition: EdgeWalkTransition }>>,
): Map<string, Array<{ event: string; to: string }>> {
  const paths = new Map<string, Array<{ event: string; to: string }>>();
  const visited = new Set<string>([source]);
  const queue: Array<{ state: string; path: Array<{ event: string; to: string }> }> = [
    { state: source, path: [] },
  ];

  while (queue.length > 0) {
    const { state, path } = queue.shift()!;
    const edges = graph.get(state) ?? [];

    for (const edge of edges) {
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      const newPath = [...path, { event: edge.event, to: edge.to }];
      paths.set(edge.to, newPath);
      queue.push({ state: edge.to, path: newPath });
    }
  }

  return paths;
}

/**
 * Find uncovered edges from a given state.
 */
function findUncoveredEdges(
  state: string,
  graph: Map<string, Array<{ event: string; to: string; transition: EdgeWalkTransition }>>,
  uncovered: Set<string>,
): Array<{ key: string; transition: EdgeWalkTransition; guardCase: 'pass' | 'fail' | null }> {
  const edges = graph.get(state) ?? [];
  const result: Array<{ key: string; transition: EdgeWalkTransition; guardCase: 'pass' | 'fail' | null }> = [];

  for (const edge of edges) {
    if (edge.transition.hasGuard) {
      const keyPass = `${state}+${edge.event}->${edge.to}[pass]`;
      const keyFail = `${state}+${edge.event}->${edge.to}[fail]`;
      // Prefer pass first (advances state), then fail
      if (uncovered.has(keyPass)) {
        result.push({ key: keyPass, transition: edge.transition, guardCase: 'pass' });
      }
      if (uncovered.has(keyFail)) {
        result.push({ key: keyFail, transition: edge.transition, guardCase: 'fail' });
      }
    } else {
      const key = `${state}+${edge.event}->${edge.to}`;
      if (uncovered.has(key)) {
        result.push({ key, transition: edge.transition, guardCase: null });
      }
    }
  }

  return result;
}

/**
 * Find the nearest state (from currentState) that has uncovered outgoing edges.
 */
function findNearestUncoveredState(
  currentState: string,
  graph: Map<string, Array<{ event: string; to: string; transition: EdgeWalkTransition }>>,
  uncovered: Set<string>,
  shortestPaths: Map<string, Map<string, Array<{ event: string; to: string }>>>,
): string | null {
  // Collect states that have uncovered edges
  const statesWithUncovered = new Set<string>();
  for (const key of uncovered) {
    // Key format: "state+EVENT->target" or "state+EVENT->target[pass]"
    const fromState = key.split('+')[0];
    statesWithUncovered.add(fromState);
  }

  // If current state has uncovered edges, return it (shouldn't happen, but handle it)
  if (statesWithUncovered.has(currentState)) return currentState;

  // Find nearest reachable state with uncovered edges
  const paths = shortestPaths.get(currentState);
  if (!paths) return null;

  let nearestState: string | null = null;
  let nearestDist = Infinity;

  for (const target of statesWithUncovered) {
    const path = paths.get(target);
    if (path && path.length < nearestDist) {
      nearestDist = path.length;
      nearestState = target;
    }
  }

  return nearestState;
}

/**
 * Build a payload for a given edge based on its guard case.
 */
function buildPayloadForEdge(
  transition: EdgeWalkTransition,
  guardCase: 'pass' | 'fail' | null,
): Record<string, unknown> {
  if (!transition.hasGuard || !transition.guard || !guardCase) {
    return {};
  }

  const payloads = buildGuardPayloads(transition.guard);
  return guardCase === 'pass' ? payloads.pass : payloads.fail;
}
