/**
 * Agent Types
 *
 * Defines the AgentContext interface and related types for the agent/* operator namespace.
 * These types are the contract between operators (language) and implementation (runtime).
 *
 * @packageDocumentation
 */

import type { ServiceParams } from './service.js';
import type { EventPayloadValue } from './expression.js';

// ============================================================================
// Agent Memory Types
// ============================================================================

/**
 * Categories for agent memories.
 */
export type AgentMemoryCategory =
    | 'preference'
    | 'correction'
    | 'pattern-affinity'
    | 'entity-template'
    | 'error-resolution';

/**
 * A single memory record stored by the agent.
 */
export interface AgentMemoryRecord {
    /** Unique memory identifier */
    id: string;
    /** Memory content (natural language) */
    content: string;
    /** Memory category */
    category: AgentMemoryCategory;
    /** Strength value (0.0-1.0), decays over time unless pinned */
    strength: number;
    /** Whether this memory is pinned (immune to decay) */
    pinned: boolean;
    /** Memory scope */
    scope: 'global' | 'project';
    /** ISO timestamp of last access */
    lastAccessedAt: string;
    /** ISO timestamp of creation */
    createdAt: string;
}

// ============================================================================
// Agent Context Types
// ============================================================================

/**
 * Strategy for context compaction.
 */
export type AgentCompactStrategy = 'hybrid' | 'summarize' | 'truncate' | 'extract';

/**
 * Result of a context compaction operation.
 */
export interface AgentCompactResult {
    /** Token count before compaction */
    before: number;
    /** Token count after compaction */
    after: number;
    /** Strategy used */
    strategy: AgentCompactStrategy;
    /** Optional summary generated during compaction */
    summary?: string;
}

// ============================================================================
// Agent LLM Types
// ============================================================================

/**
 * Options for agent/generate calls.
 */
export interface AgentGenerateOptions {
    /** LLM provider override */
    provider?: string;
    /** Model override */
    model?: string;
    /** Maximum tokens to generate */
    maxTokens?: number;
}

// ============================================================================
// Agent Search Types
// ============================================================================

/**
 * Result from agent/search-code.
 */
export interface AgentCodeSearchResult {
    /** Repository name (owner/repo) */
    repo: string;
    /** File path within the repository */
    path: string;
    /** URL to the file */
    url: string;
}

// ============================================================================
// Agent Context Interface
// ============================================================================

/**
 * AgentContext is the runtime contract for agent/* operators.
 *
 * The evaluator dispatches agent/* operators to methods on this interface.
 * Pure methods (usable in guards) return synchronously.
 * Effect methods return Promises.
 *
 * When ctx.agent is undefined, operators return safe defaults ([], 0, false, "").
 * Implementations live in @almadar-io/agent-runtime (Phase 2B).
 */
export interface AgentContext {
    // Memory (pure)
    recall(query: string, limit?: number): AgentMemoryRecord[];
    memories(category?: AgentMemoryCategory): AgentMemoryRecord[];
    memoryStrength(id: string): number;
    isPinned(id: string): boolean;

    // Memory (effects)
    memorize(content: string, category: AgentMemoryCategory, scope?: 'global' | 'project'): Promise<string>;
    forget(id: string): Promise<void>;
    pin(id: string): Promise<void>;
    reinforce(id: string): Promise<void>;
    decay(): Promise<number>;

    // LLM (pure)
    provider(): string;
    model(): string;

    // LLM (effects)
    generate(prompt: string, options?: AgentGenerateOptions): Promise<string>;
    switchProvider(provider: string, model?: string): void;

    // Tools (pure)
    tools(): string[];

    // Tools (effects)
    invoke(toolName: string, args: ServiceParams): Promise<EventPayloadValue>;

    // Context (pure)
    tokenCount(): number;
    contextUsage(): number;

    // Context (effects)
    compact(strategy?: AgentCompactStrategy): Promise<AgentCompactResult>;

    // Session (pure)
    sessionId(): string;

    // Session (effects)
    fork(label?: string): Promise<string>;
    label(text: string): void;

    // Search (effects)
    searchCode(query: string, language?: string): Promise<AgentCodeSearchResult[]>;
}
