/**
 * Agent-trace view-model — the canonical render shapes for the studio's
 * agent-trace UI (ChatBar, SubagentTracePanel and their sub-components).
 *
 * Promoted out of apps/builder so the trace components can move into
 * `@almadar/ui` without depending on `@almadar-io/agent-trace`,
 * `@almadar-io/rabit`, or apps/builder-local hooks. These are pure
 * presentation shapes — what the components read, nothing the runtime
 * produces. Arbitrary tool payloads use core's `JsonValue` / `ToolArgs`
 * (see `./types/json`), never `unknown`.
 *
 * @packageDocumentation
 */

import type { JsonValue, ToolArgs } from './types/json.js';

// ----------------------------------------------------------------------------
// Shared leaf shapes
// ----------------------------------------------------------------------------

/** Conversational role rendered with an avatar/icon in the trace stream. */
export type TraceAvatarRole = 'user' | 'assistant' | 'system';

/** File-mutation kind surfaced by a `file_operation` trace activity. */
export type TraceFileOperation = 'ls' | 'read_file' | 'write_file' | 'edit_file';

/** A single line within a unified-diff hunk. */
export interface TraceDiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
}

/** A unified-diff hunk rendered by a `schema_diff` trace activity. */
export interface TraceDiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: TraceDiffLine[];
}

// ----------------------------------------------------------------------------
// TraceActivity — the coordinator/page-level `Activity` discriminated union
// ----------------------------------------------------------------------------

/**
 * Page-level agent activity. Discriminated by `type`; each variant carries
 * only the fields the trace components read. Mirrors apps/builder's local
 * `Activity` union (useAgentChat.ts). Tool args are `ToolArgs`, tool results
 * are `JsonValue` — no `unknown`.
 */
export type TraceActivity =
  | { type: 'message'; role: TraceAvatarRole; content: string; timestamp: number; isStreaming?: boolean }
  | { type: 'tool_call'; tool: string; args: ToolArgs; timestamp: number; isExecuting?: boolean }
  | { type: 'tool_result'; tool: string; result: JsonValue; success: boolean; timestamp: number }
  | { type: 'file_operation'; operation: TraceFileOperation; path: string; success?: boolean; timestamp: number }
  | { type: 'schema_diff'; filePath: string; hunks: TraceDiffHunk[]; timestamp: number }
  | { type: 'error'; message: string; code?: string; timestamp: number }
  | { type: 'coordinator_decision'; organism: string; reason: string; priorOrganism: string | null; timestamp: number }
  | { type: 'plan_committed'; orbitals: string[]; timestamp: number }
  | { type: 'pending_question'; questionId: string; question: string; orbitalName?: string; timestamp: number }
  | {
      type: 'clarification_question';
      level: 'organism' | 'molecule' | 'atom_trait';
      scope: { orbitalName?: string; traitName?: string };
      question: string;
      candidates: Array<{
        id: string;
        label: string;
        description: string;
        whyThisFits: string;
      }>;
      skipDefault: string;
      timestamp: number;
    };

// ----------------------------------------------------------------------------
// TraceActivityItem — the agent-trace `ActivityItem` render union
// ----------------------------------------------------------------------------

/**
 * Trace-stream activity item, the shape `InlineActivityRow` /
 * `InlineActivityStream` render. Mirrors `@almadar-io/agent-trace`'s
 * `ActivityItem`. Distinct from `TraceActivity`: `message.role` includes
 * `'tool'` and an optional `label`; it omits the coordinator/plan/question
 * variants. Tool args are `ToolArgs`, results are `JsonValue`.
 */
export type TraceActivityItem =
  | {
      type: 'message';
      role: TraceAvatarRole | 'tool';
      content: string;
      timestamp: number;
      isStreaming?: boolean;
      label?: string;
    }
  | { type: 'tool_call'; tool: string; args: ToolArgs; timestamp: number; isExecuting?: boolean }
  | { type: 'tool_result'; tool: string; result: JsonValue; success: boolean; timestamp: number; durationMs?: number }
  | { type: 'file_operation'; operation: TraceFileOperation; path: string; success?: boolean; timestamp: number }
  | { type: 'schema_diff'; filePath: string; hunks: TraceDiffHunk[]; timestamp: number }
  | { type: 'error'; message: string; code?: string; timestamp: number }
  | { type: 'milestone'; milestone: string; summary?: string; timestamp: number };

// ----------------------------------------------------------------------------
// TraceSubagent — the `SubagentState` panel model
// ----------------------------------------------------------------------------

/** One progress entry within a subagent's running log. */
export interface TraceSubagentMessage {
  message: string;
  tool?: string;
  timestamp: number;
}

/**
 * Live subagent state rendered by `SubagentRow` / `SubagentRichCard` /
 * `OrbitalGroup`. Mirrors apps/builder's `SubagentState`. `orbitalName` is
 * the canvas-focus filter key.
 */
export interface TraceSubagent {
  id: string;
  name: string;
  role: string;
  orbitalName?: string;
  parentId?: string;
  status: 'running' | 'complete' | 'error';
  task: string;
  messages: TraceSubagentMessage[];
  durationMs?: number;
  /** Full nested activity (tool calls, messages, milestones) for a rich
   *  per-subagent detail view — additive, optional; `messages` remains the
   *  flat progress-log shape for consumers that only need that. */
  timeline?: ReadonlyArray<TraceActivityItem>;
}

// ----------------------------------------------------------------------------
// TraceChatMessage — the rabit tool-loop `ChatMessage` model
// ----------------------------------------------------------------------------

/** A tool call emitted by an assistant `TraceChatMessage`. */
export interface TraceChatMessageToolCall {
  id: string;
  name: string;
  /** Parsed JSON arguments (the LLM emits a JSON string; stored parsed). */
  args: ToolArgs;
}

/**
 * Canonical coordinator conversation message rendered by `ChatMessageRow` /
 * `CoordinatorConversation`. Mirrors rabit's tool-loop `ChatMessage`
 * (role/content/toolCalls/toolCallId/toolName/reasoningContent).
 */
export interface TraceChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Present on assistant messages that called tools. */
  toolCalls?: ReadonlyArray<TraceChatMessageToolCall>;
  /** Present on tool messages — matches the `id` of the corresponding tool_call. */
  toolCallId?: string;
  /** Tool name on tool messages (cosmetic — helps tracing). */
  toolName?: string;
  /** Thinking-mode chain-of-thought (DeepSeek), echoed back on tool round-trips. */
  reasoningContent?: string;
}
