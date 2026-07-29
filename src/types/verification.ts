/**
 * Verification Types (framework concept)
 *
 * The `window.__orbitalVerification` bridge is the single observation
 * point Playwright-based verifiers (`orbital-verify`, `runtime-verify`,
 * `@almadar-io/verify`) use to read runtime state out of a live app.
 * Its shape was previously duplicated between `@almadar/ui`'s
 * `verificationRegistry.ts` (producer) and `@almadar-io/verify`'s
 * `state-bridge.ts` (consumer). Every added field had to be mirrored
 * by hand; one side drifting silently broke the other.
 *
 * Hoisting the wire types into `@almadar/core` closes that gap the same
 * way {@link BusEvent} closed the UI/runtime event-shape drift. The
 * registry still owns the state machine, the schedule, and the window
 * exposure — this module owns only the shapes both sides agree on.
 *
 * @packageDocumentation
 */

import type { EntityRow } from "./entity.js";
import type { EventPayload, SExpr } from "./expression.js";
import type { BusEventSource } from "./bus.js";

// ── Checks ────────────────────────────────────────────────────────────

/**
 * Outcome of a single verification check. `warn` is non-fatal in the
 * overall pass/fail tally; `pending` means the check has been registered
 * but not yet resolved.
 */
export type CheckStatus = "pass" | "fail" | "pending" | "warn";

export interface VerificationCheck {
  id: string;
  label: string;
  status: CheckStatus;
  details?: string;
  /** Timestamp (ms since epoch) when the status last changed. */
  updatedAt: number;
}

// ── Transition timeline ──────────────────────────────────────────────

/**
 * Trace of a single effect as it ran on a transition. `args` are the
 * effect tuple's trailing S-expressions; consumers narrow via `type`
 * before inspecting.
 */
export interface EffectTrace {
  type: string;
  /** For fetch/persist effects: the entity the effect addresses. */
  entityName?: string;
  args: SExpr[];
  status: "executed" | "failed" | "skipped";
  error?: string;
  durationMs?: number;
}

/** What the server returned for a forwarded event. */
export interface ServerResponseTrace {
  orbitalName: string;
  success: boolean;
  clientEffects: number;
  dataEntities: Record<string, number>;
  emittedEvents: string[];
  error?: string;
  timestamp: number;
}

export interface TransitionTrace {
  id: string;
  traitName: string;
  from: string;
  to: string;
  event: string;
  guardExpression?: string;
  guardResult?: boolean;
  effects: EffectTrace[];
  /** Populated when the event round-tripped to the server. */
  serverResponse?: ServerResponseTrace;
  timestamp: number;
}

// ── Bridge health / summary ───────────────────────────────────────────

export interface BridgeHealth {
  connected: boolean;
  eventsForwarded: number;
  eventsReceived: number;
  lastError?: string;
  lastHeartbeat: number;
}

export interface VerificationSummary {
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  pending: number;
}

// ── Trait reducer snapshot ────────────────────────────────────────────

/**
 * Per-trait state snapshot exposed to the verifier so it can assert
 * that reducer data (populated by fetch/persist transitions) and the
 * last dispatched payload land in the DOM correctly (VG4/VG6/VG11a/b/c).
 *
 * Mirrors what `useTraitStateMachine` / generated trait logic hooks
 * keep internally, without the verifier having to parse rendered text.
 */
export interface TraitStateSnapshot {
  /** Trait name as declared in the schema. */
  traitName: string;
  /** Current state machine state. */
  currentState: string;
  /** Declared state names for this trait (non-empty for healthy refs). */
  states: string[];
  /** Declared event keys for this trait (non-empty for healthy refs). */
  events: string[];
  /**
   * Entity data keyed by entity name. Uses {@link EntityRow} — the
   * canonical persisted-entity shape the server returns and the trait
   * reducer stores. Consumers that need full field-level types can cast
   * down to the generated entity (e.g. `data['CartItem'] as CartItem[]`).
   * Snapshot-on-read; mutating the returned arrays does not affect the
   * live reducer.
   */
  data: Record<string, EntityRow[]>;
  /** Payload of the last event the state machine processed, if any. */
  lastPayload?: EventPayload;
  /**
   * Last event the walker (or a UI click) dispatched into this trait.
   * Used by VG11a to resolve `@payload.X` expected values.
   */
  lastEventDispatched?: {
    event: string;
    payload?: EventPayload;
    source?: BusEventSource;
    timestamp: number;
  };
  /**
   * Bus events received from the server's `emittedEvents` cascade
   * since the last user dispatch. VG4 compares the length against the
   * number of `emit: { success/failure: ... }` entries on the
   * triggering transition.
   */
  cascadeReceived: Array<{
    event: string;
    payload?: EventPayload;
    timestamp: number;
  }>;
}

// ── Top-level snapshot ────────────────────────────────────────────────

export interface VerificationSnapshot {
  checks: VerificationCheck[];
  transitions: TransitionTrace[];
  bridge: BridgeHealth | null;
  summary: VerificationSummary;
  /**
   * Per-trait reducer snapshots. Empty on older runtimes that predate
   * the Foundation 1 expansion; non-empty once any trait hook has
   * registered a snapshot getter.
   */
  traits: TraitStateSnapshot[];
}

// ── Side-channel observation surfaces ────────────────────────────────

/** Asset load status exposed for canvas-based game verification. */
export type AssetLoadStatus = "loaded" | "failed" | "pending";

/**
 * Entry recorded on the verification event log. The registry ring-buffers
 * the log to the last `MAX_EVENT_LOG` entries (evicting the oldest, never
 * the recent tail) so long runs don't grow unbounded — see
 * `verificationRegistry` and `eventLogDropped`.
 */
export interface EventLogEntry {
  type: string;
  payload?: EventPayload;
  timestamp: number;
}

// ── Window bridge contract ───────────────────────────────────────────

/**
 * A drawable descriptor as exposed over the verification bridge. The
 * concrete `DrawableNode` union lives downstream in `@almadar/ui`
 * (`lib/drawable/paintDispatch.ts`) and cannot be imported here without
 * inverting the dependency axis; the bridge contract carries the `type`
 * discriminant (`draw-sprite`, `draw-shape`, …) that verifiers narrow on.
 */
export interface DrawableDescriptor {
  type: string;
}

/**
 * The object attached to `window.__orbitalVerification`. Every optional
 * member is wired up by a corresponding `bind*` / `register*` call on
 * the registry (e.g. `bindEventBus` populates `sendEvent`). Consumers
 * should null-check before calling — an older bundle might expose only
 * the core readers.
 */
export interface OrbitalVerificationAPI {
  getSnapshot: () => VerificationSnapshot;
  getChecks: () => VerificationCheck[];
  getTransitions: () => TransitionTrace[];
  getBridge: () => BridgeHealth | null;
  getSummary: () => VerificationSummary;
  /** Wait for a specific event to be processed. Resolves to null on timeout. */
  waitForTransition: (
    event: string,
    timeoutMs?: number,
  ) => Promise<TransitionTrace | null>;
  /**
   * Send an event into the runtime. Requires {@link bindEventBus} (in
   * `@almadar/ui`) to have run at least once. Payload typed as
   * {@link EventPayload} so callers can't slip non-bus-shaped data in.
   *
   * `traitScope` is the qualified `Orbital.Trait` (or `App.Trait`)
   * scope that bus listeners subscribe under. The bridge constructs
   * `UI:${traitScope}.${event}` and emits that on the bus, matching
   * the codegen-emitted subscription keys (gap #13). When omitted,
   * the legacy bare-prefix form `UI:${event}` is used — kept only
   * for system-scope events like `UI:NOTIFY`; trait-driven dispatch
   * MUST pass a `traitScope`.
   */
  sendEvent?: (
    event: string,
    payload?: EventPayload,
    traitScope?: string,
  ) => void;
  /** Current state name for a given trait, if known. */
  getTraitState?: (traitName: string) => string | undefined;
  /** Per-trait reducer snapshots (VG4/VG6/VG11a/b/c). */
  getTraitSnapshots?: () => TraitStateSnapshot[];
  /** Canvas frame capture. Populated by game organisms on mount. */
  captureFrame?: () => string | null;
  /** Last neutral drawables list received by the active canvas host. */
  getLastDrawables?: () => DrawableDescriptor[] | null;
  /** Asset-url → load-status map. Populated by game organisms. */
  assetStatus?: Record<string, AssetLoadStatus>;
  /** Rolling event bus log. Populated by `bindEventBus`. */
  eventLog?: EventLogEntry[];
  /**
   * Per-page-load nonce, set once when `bindEventBus` creates the log
   * (and bumped by `clearEventLog`). A verifier reading the log across
   * hermetic page reloads uses this — not the array length — to detect a
   * reset: the length can coincidentally refill to the same count after a
   * reload, which silently drops the post-reload delta. The epoch changing
   * is the only reliable reset signal.
   */
  eventLogEpoch?: string;
  /**
   * Count of entries evicted from the FRONT of the ring-buffered log this
   * page (see `MAX_EVENT_LOG`). The absolute index of `eventLog[i]` is
   * `eventLogDropped + i`, so a verifier can cursor by absolute position
   * even after eviction — the recent (driven) tail is never silently lost.
   */
  eventLogDropped?: number;
  /** Clear the event log in place (also bumps `eventLogEpoch`). */
  clearEventLog?: () => void;
}
