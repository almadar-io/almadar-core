/**
 * State Machine Graph Algorithm Types
 *
 * Pure types used by BFS, guard payload, and replay path algorithms.
 * These are decoupled from the verify-specific types (no Playwright, no HTTP).
 *
 * @packageDocumentation
 */

/** An edge in the state graph adjacency list */
export interface StateEdge {
  event: string;
  to: string;
}

/** A node in the BFS queue */
export interface BFSNode {
  state: string;
  depth: number;
}

/** A node in the BFS queue with a replay path */
export interface BFSPathNode {
  fromState: string;
  replayPath: ReplayStep[];
}

/** A single step to replay to reach a given state */
export interface ReplayStep {
  /** Event to fire */
  event: string;
  /** State we're coming from */
  fromState: string;
  /** State we're transitioning to */
  toState: string;
  /** Slot the pattern renders in */
  slot: string;
  /** Pattern expected in the slot after this step */
  expectedPattern?: string;
  /** True if this step requires entity rows to be visible before clicking */
  needsEntityData: boolean;
  /** Payload to supply for this step (derived from guard pass case if guarded) */
  guardPayload?: Record<string, unknown>;
  /** Full payload schema for mock data generation */
  payloadSchema?: PayloadFieldSchema[];
}

/** Payload field definition (name + type) */
export interface PayloadFieldSchema {
  name: string;
  type: string;
  required?: boolean;
}

/** Pass and fail payloads derived from a guard s-expression */
export interface GuardPayload {
  pass: Record<string, unknown>;
  fail: Record<string, unknown>;
}

/**
 * Minimal transition interface for graph algorithms.
 * Compatible with both @almadar/core Transition and orbital-verify UnifiedTransition.
 */
export interface GraphTransition {
  from: string;
  event: string;
  to: string;
}
