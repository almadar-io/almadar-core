/**
 * BFS Reachability Algorithms
 *
 * Breadth-first search over state machine graphs.
 * Extracted from orbital-verify-unified/src/analyze.ts and phase3-server.ts.
 *
 * @packageDocumentation
 */

import type { BFSNode, StateEdge } from './types.js';
import { buildStateGraph } from './graph.js';
import type { GraphTransition } from './types.js';

/**
 * Collect all reachable states from an initial state via BFS.
 *
 * @param transitions - State machine transitions
 * @param initialState - Starting state
 * @param maxDepth - Maximum BFS depth (default: 5)
 * @returns Set of reachable state names
 */
export function collectReachableStates(
  transitions: GraphTransition[],
  initialState: string,
  maxDepth = 5
): Set<string> {
  const graph = buildStateGraph(transitions);
  const visited = new Set<string>([initialState]);
  const queue: BFSNode[] = [{ state: initialState, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;

    const edges = graph.get(current.state) ?? [];
    for (const edge of edges) {
      if (!visited.has(edge.to)) {
        visited.add(edge.to);
        queue.push({ state: edge.to, depth: current.depth + 1 });
      }
    }
  }

  return visited;
}

/**
 * Walk all (state, event) pairs reachable via BFS and invoke a callback for each.
 * Used by the server verification to POST each transition and check the response.
 *
 * @param transitions - State machine transitions
 * @param initialState - Starting state
 * @param maxDepth - Maximum BFS depth (default: 5)
 * @param visitor - Callback invoked for each (state, edge) pair.
 *   Return true to enqueue the target state for further exploration.
 */
export async function walkStatePairs(
  transitions: GraphTransition[],
  initialState: string,
  maxDepth: number,
  visitor: (state: string, edge: StateEdge, depth: number) => Promise<boolean>
): Promise<{ visitedPairs: Set<string>; walkedEdges: number }> {
  const graph = buildStateGraph(transitions);
  const visitedPairs = new Set<string>();
  const queue: BFSNode[] = [{ state: initialState, depth: 0 }];
  let walkedEdges = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;

    const edges = graph.get(current.state) ?? [];
    for (const edge of edges) {
      const pairKey = `${current.state}:${edge.event}`;
      if (visitedPairs.has(pairKey)) continue;
      visitedPairs.add(pairKey);

      const shouldEnqueue = await visitor(current.state, edge, current.depth);
      walkedEdges++;

      if (shouldEnqueue) {
        const stateVisited = [...visitedPairs].some((k) => k.startsWith(`${edge.to}:`));
        if (!stateVisited) {
          queue.push({ state: edge.to, depth: current.depth + 1 });
        }
      }
    }
  }

  return { visitedPairs, walkedEdges };
}
