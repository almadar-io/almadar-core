/**
 * Replay Path Builder
 *
 * Compute the shortest path (replay steps) from an initial state
 * to every reachable state in a state machine. Used by browser
 * verification to navigate through states before running assertions.
 *
 * Extracted from orbital-verify-unified/src/analyze.ts (collectDataMutationTests).
 *
 * @packageDocumentation
 */

import type { GraphTransition, ReplayStep, PayloadFieldSchema } from './types.js';

/** Entity-data sentinel payload fields: presence means transition needs a selected row */
const ENTITY_PAYLOAD_FIELDS = new Set(['data', 'row', 'item', 'id']);

/**
 * Extended transition with render and payload info needed for replay path building.
 * Compatible with orbital-verify's UnifiedTransition.
 */
export interface ReplayTransition extends GraphTransition {
  hasGuard: boolean;
  guard?: unknown[];
  payloadFields: string[];
  payloadSchema: PayloadFieldSchema[];
  renderEffects: Array<{
    slot: string;
    patternType: string | null;
  }>;
}

/**
 * Build the shortest replay path from initialState to every reachable state.
 *
 * @param transitions - Transitions with render/payload info
 * @param initialState - Starting state
 * @param maxDepth - Maximum path length (default: 3, shorter than BFS exploration)
 * @returns Map of state -> replay steps to reach it
 */
export function buildReplayPaths(
  transitions: ReplayTransition[],
  initialState: string,
  maxDepth = 3
): Map<string, ReplayStep[]> {
  type QueueNode = { state: string; path: ReplayStep[] };

  const queue: QueueNode[] = [{ state: initialState, path: [] }];
  const replayPaths = new Map<string, ReplayStep[]>();
  replayPaths.set(initialState, []);

  while (queue.length > 0) {
    const { state, path } = queue.shift()!;
    if (path.length >= maxDepth) continue;

    const fromHere = transitions.filter(
      (t) => t.from === state && t.event !== 'INIT',
    );

    for (const transition of fromHere) {
      if (replayPaths.has(transition.to)) continue;

      const renderEffect = transition.renderEffects.find((re) => re.patternType !== null);
      const stepNeedsEntityData =
        transition.hasGuard ||
        transition.payloadFields.some((f) => ENTITY_PAYLOAD_FIELDS.has(f));

      const step: ReplayStep = {
        event: transition.event,
        fromState: state,
        toState: transition.to,
        slot: renderEffect?.slot ?? 'main',
        expectedPattern: renderEffect?.patternType ?? undefined,
        needsEntityData: stepNeedsEntityData,
        payloadSchema: transition.payloadSchema.length > 0 ? transition.payloadSchema : undefined,
      };

      const newPath = [...path, step];
      replayPaths.set(transition.to, newPath);
      queue.push({ state: transition.to, path: newPath });
    }
  }

  return replayPaths;
}
