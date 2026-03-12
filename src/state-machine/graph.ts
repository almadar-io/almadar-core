/**
 * State Graph Construction
 *
 * Build an adjacency list from state machine transitions.
 * Extracted from orbital-verify-unified/src/analyze.ts.
 *
 * @packageDocumentation
 */

import type { GraphTransition, StateEdge } from './types.js';

/**
 * Build an adjacency list: state -> [{ event, to }].
 * Wildcard transitions (from === '*') are excluded since they
 * don't represent fixed edges in the graph.
 */
export function buildStateGraph(
  transitions: GraphTransition[]
): Map<string, StateEdge[]> {
  const graph = new Map<string, StateEdge[]>();
  for (const t of transitions) {
    if (t.from === '*') continue;
    if (!graph.has(t.from)) graph.set(t.from, []);
    graph.get(t.from)!.push({ event: t.event, to: t.to });
  }
  return graph;
}
