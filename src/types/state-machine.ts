/**
 * State Machine Types (Self-Contained)
 *
 * Defines state machine types for traits.
 * Copied from schema/state-machine.ts to make orbitals/ self-contained.
 *
 * @packageDocumentation
 */

import { z } from "zod";
import type { Effect } from "./effect.js";
import { EffectSchema } from "./effect.js";
import type { Expression } from "./expression.js";
import { ExpressionSchema } from "./expression.js";

// ============================================================================
// State
// ============================================================================

/**
 * Represents a state in the state machine
 */
export interface State {
  /** State name (unique identifier) */
  name: string;
  /** Whether this is the initial state */
  isInitial?: boolean;
  /** Whether this is a terminal state (no outgoing transitions expected) */
  isTerminal?: boolean;
  /** Whether this is a final state (legacy alias for isTerminal) */
  isFinal?: boolean;
  /** Human-readable description */
  description?: string;
  /** Effect names to run on entry */
  onEntry?: string[];
  /** Effect names to run on exit */
  onExit?: string[];
}

export const StateSchema = z.object({
  name: z.string().min(1, "State name is required"),
  isInitial: z.boolean().optional(),
  isTerminal: z.boolean().optional(),
  isFinal: z.boolean().optional(),
  description: z.string().optional(),
  onEntry: z.array(z.string()).optional(),
  onExit: z.array(z.string()).optional(),
});

// ============================================================================
// Event
// ============================================================================

/**
 * Payload field definition for events
 */
export interface PayloadField {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  required?: boolean;
}

export const PayloadFieldSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "number", "boolean", "object", "array"]),
  required: z.boolean().optional(),
});

/**
 * Represents an event that can trigger transitions
 */
export interface Event {
  /** Event key (UPPER_SNAKE_CASE) */
  key: string;
  /** Human-readable name */
  name: string;
  /** Description */
  description?: string;
  /** Expected payload structure */
  payloadSchema?: PayloadField[];
  /** Domain vs System classification (optional, for analysis) */
  classification?: "domain" | "system";
  /** Semantic role of this event (optional, for analysis) */
  semanticRole?: string;
}

export const EventSchema = z.object({
  key: z.string().min(1, "Event key is required"),
  name: z.string().min(1, "Event name is required"),
  description: z.string().optional(),
  payloadSchema: z.array(PayloadFieldSchema).optional(),
  classification: z.enum(["domain", "system"]).optional(),
  semanticRole: z.string().optional(),
});

// ============================================================================
// Guard
// ============================================================================

/**
 * Represents a named guard condition.
 * Expression must be an S-expression.
 *
 * @example
 * {
 *   name: "hasHealth",
 *   expression: [">", "@entity.health", 0],
 *   description: "Check if entity has health remaining"
 * }
 */
export interface Guard {
  name: string;
  /** Guard expression - S-expression array only */
  expression: Expression;
  description?: string;
}

export const GuardSchema = z.object({
  name: z.string().min(1, "Guard name is required"),
  expression: ExpressionSchema,
  description: z.string().optional(),
});

// ============================================================================
// Transition (Effect imported separately to avoid circular deps)
// ============================================================================

/**
 * Represents a transition between states.
 * Guards and effects must be S-expressions.
 *
 * @example
 * {
 *   from: "idle",
 *   to: "running",
 *   event: "START",
 *   guard: [">", "@entity.fuel", 0],
 *   effects: [
 *     ["set", "@entity.status", "running"],
 *     ["emit", "ENGINE_STARTED"]
 *   ]
 * }
 */
export interface Transition {
  /** Source state name */
  from: string;
  /** Target state name */
  to: string;
  /** Event key that triggers this transition */
  event: string;
  /** Guard expression - S-expression array */
  guard?: Expression | null;
  /** Effects to execute - S-expression arrays */
  effects?: Effect[];
  /** Description */
  description?: string | null;
}

export const TransitionSchema = z.object({
  from: z.string().min(1, "Transition source state is required"),
  to: z.string().min(1, "Transition target state is required"),
  event: z.string().min(1, "Transition event is required"),
  guard: ExpressionSchema.nullish(),
  effects: z.array(EffectSchema).optional(),
  description: z.string().nullish(),
});

// ============================================================================
// State Machine
// ============================================================================

/**
 * Complete state machine definition
 */
export interface StateMachine {
  /** All states in the machine */
  states: State[];
  /** All events that can be triggered */
  events: Event[];
  /** All transitions between states */
  transitions: Transition[];
  /** Named guard definitions */
  guards?: Guard[];
}

export const StateMachineSchema = z.object({
  states: z.array(StateSchema).min(1, "At least one state is required"),
  events: z.array(EventSchema),
  transitions: z.array(TransitionSchema),
  guards: z.array(GuardSchema).optional(),
});

// ============================================================================
// Type exports
// ============================================================================

export type StateInput = z.input<typeof StateSchema>;
export type EventInput = z.input<typeof EventSchema>;
export type GuardInput = z.input<typeof GuardSchema>;
export type TransitionInput = z.input<typeof TransitionSchema>;
export type StateMachineInput = z.input<typeof StateMachineSchema>;
