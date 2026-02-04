/**
 * Domain Context Types (Self-Contained)
 *
 * Defines domain classification types for applications.
 * Copied from schema/domain-context.ts to make orbitals/ self-contained.
 *
 * @packageDocumentation
 */

import { z } from "zod";

// ============================================================================
// Domain Categories
// ============================================================================

/**
 * High-level domain categories
 */
export type DomainCategory =
  | "healthcare"
  | "education"
  | "finance"
  | "ecommerce"
  | "real-estate"
  | "logistics"
  | "hospitality"
  | "hr-management"
  | "project-management"
  | "social"
  | "content-management"
  | "iot"
  | "analytics"
  | "game"
  | "custom";

export const DomainCategorySchema = z.enum([
  "healthcare",
  "education",
  "finance",
  "ecommerce",
  "real-estate",
  "logistics",
  "hospitality",
  "hr-management",
  "project-management",
  "social",
  "content-management",
  "iot",
  "analytics",
  "game",
  "custom",
]);

// ============================================================================
// Game Sub-Categories
// ============================================================================

/**
 * Game genre sub-categories
 */
export type GameSubCategory =
  | "platformer"
  | "shooter"
  | "puzzle"
  | "rpg"
  | "board"
  | "racing"
  | "fighting"
  | "tower-defense"
  | "endless-runner"
  | "simulation"
  | "arcade"
  | "adventure";

export const GameSubCategorySchema = z.enum([
  "platformer",
  "shooter",
  "puzzle",
  "rpg",
  "board",
  "racing",
  "fighting",
  "tower-defense",
  "endless-runner",
  "simulation",
  "arcade",
  "adventure",
]);

// ============================================================================
// Node Classification
// ============================================================================

/**
 * Domain vs System classification
 */
export type NodeClassification = "domain" | "system";

export const NodeClassificationSchema = z.enum(["domain", "system"]);

// ============================================================================
// Semantic Roles
// ============================================================================

export type StateSemanticRole =
  | "pending"
  | "active"
  | "completed"
  | "cancelled"
  | "error"
  | "suspended"
  | "blocked"
  | "domain_workflow"
  | "domain_status"
  | "system_loading"
  | "system_error"
  | "system_idle"
  | "system_editing"
  | "system_confirming";

export const StateSemanticRoleSchema = z.enum([
  "pending",
  "active",
  "completed",
  "cancelled",
  "error",
  "suspended",
  "blocked",
  "domain_workflow",
  "domain_status",
  "system_loading",
  "system_error",
  "system_idle",
  "system_editing",
  "system_confirming",
]);

export type EventSemanticRole =
  | "domain_action"
  | "domain_trigger"
  | "system_crud"
  | "system_navigation"
  | "system_form"
  | "system_ui";

export const EventSemanticRoleSchema = z.enum([
  "domain_action",
  "domain_trigger",
  "system_crud",
  "system_navigation",
  "system_form",
  "system_ui",
]);

export type EntitySemanticRole =
  | "domain_core"
  | "domain_supporting"
  | "domain_reference"
  | "system_user"
  | "system_config"
  | "system_audit";

export const EntitySemanticRoleSchema = z.enum([
  "domain_core",
  "domain_supporting",
  "domain_reference",
  "system_user",
  "system_config",
  "system_audit",
]);

// ============================================================================
// Domain Vocabulary
// ============================================================================

/**
 * Domain-specific vocabulary for naming conventions.
 * Maps generic terms to domain-appropriate labels.
 */
export interface DomainVocabulary {
  /** Label for items (e.g., "Task", "Cargo", "Patient") */
  item?: string;
  /** Label for collections (e.g., "Tasks", "Inventory", "Patients") */
  collection?: string;
  /** Label for create action (e.g., "Add", "Recruit", "Admit") */
  create?: string;
  /** Label for delete action (e.g., "Remove", "Discharge", "Archive") */
  delete?: string;
  /** Label for container (e.g., "List", "Hold", "Ward") */
  container?: string;
  /** Additional custom vocabulary */
  [key: string]: string | undefined;
}

export const DomainVocabularySchema = z
  .record(z.string(), z.string())
  .optional();

// ============================================================================
// Domain Context (Simplified for Design System)
// ============================================================================

/**
 * User persona for UX decisions
 */
export interface UserPersona {
  /** Persona name */
  name: string;
  /** Role for RBAC */
  role?: string;
  /** Primary device */
  device?: "mobile" | "tablet" | "desktop";
}

export const UserPersonaSchema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  device: z.enum(["mobile", "tablet", "desktop"]).optional(),
});

/**
 * Domain context - user request + classification
 */
export interface DomainContext {
  /** Original user request - verbatim (typically at schema level) */
  request: string;
  /**
   * The verbatim excerpt or summary of the user request that produced THIS orbital.
   *
   * Purpose: Traceability - know exactly what the user asked for that led to this orbital.
   *
   * Can be:
   * - Exact quote: "...with a calendar that syncs with Google Calendar..."
   * - Summarized: "Calendar integration with Google Calendar sync"
   *
   * Examples:
   * - Request: "Build a project management app with tasks, team collaboration, and Gantt charts"
   * - Task orbital: requestFragment: "tasks"
   * - Team orbital: requestFragment: "team collaboration"
   * - Timeline orbital: requestFragment: "Gantt charts"
   *
   * This enables:
   * - Understanding WHY this orbital exists
   * - Regenerating with original context preserved
   * - Validating the orbital matches user intent
   */
  requestFragment?: string;
  /** Domain category */
  category: "game" | "business" | "dashboard" | "form" | "content" | "social";
  /** Sub-domain for more specific classification */
  subDomain?: string;
  /** User personas */
  personas?: UserPersona[];
  /** Domain-specific vocabulary for naming */
  vocabulary?: DomainVocabulary;
}

export const DomainContextSchema = z.object({
  request: z.string().min(1, "Original request is required"),
  requestFragment: z.string().optional(),
  category: z.enum([
    "game",
    "business",
    "dashboard",
    "form",
    "content",
    "social",
  ]),
  subDomain: z.string().optional(),
  personas: z.array(UserPersonaSchema).optional(),
  vocabulary: DomainVocabularySchema.optional(),
});

// ============================================================================
// UX Hints
// ============================================================================

/**
 * UX hints for guiding UI generation.
 * These inform pattern selection and layout decisions.
 */
/**
 * UX hints for guiding UI generation.
 * These inform pattern selection and layout decisions.
 *
 * Note: These are HINTS, not strict requirements. LLMs may use any string value
 * including 'dashboard-grid', 'none', etc. The subagent generator interprets these
 * flexibly to produce appropriate render-ui effects.
 */
export interface UXHints {
  /** Overall user flow pattern (e.g., 'hub-spoke', 'crud-cycle', 'linear') */
  flowPattern?: string;
  /** Pattern for displaying lists (e.g., 'entity-table', 'entity-cards', 'dashboard-grid', 'none') */
  listPattern?: string;
  /** Pattern for create/edit forms (e.g., 'modal', 'drawer', 'page', 'none') */
  formPattern?: string;
  /** Pattern for entity detail views (e.g., 'drawer', 'page', 'split', 'none') */
  detailPattern?: string;
  /** Cross-orbital navigation links */
  relatedLinks?: RelatedLink[];
}

// UX hints use flexible string types - they are guidance, not strict validation
export const UXHintsSchema = z.object({
  flowPattern: z.string().optional(),
  listPattern: z.string().optional(),
  formPattern: z.string().optional(),
  detailPattern: z.string().optional(),
  relatedLinks: z.array(z.lazy(() => RelatedLinkSchema)).optional(),
});

/**
 * Related link for cross-orbital navigation.
 */
export interface RelatedLink {
  /** Field name of the relation (e.g., "customerId") */
  relation: string;
  /** Button/link text (e.g., "View Customer") */
  label: string;
  /** Target view type */
  targetView?: "list" | "detail";
}

export const RelatedLinkSchema = z.object({
  relation: z.string().min(1),
  label: z.string().min(1),
  targetView: z.enum(["list", "detail"]).optional(),
});

// ============================================================================
// Suggested Guards (Pre-Generation)
// ============================================================================

/**
 * Suggested guard - natural language description for decomposition phase.
 * Generator converts these to S-expressions during generation.
 */
export interface SuggestedGuard {
  /** Unique identifier */
  id: string;
  /** Natural language description (e.g., "Weight must be under 1000kg") */
  description: string;
  /** Events this guard applies to (e.g., ["Cargo.CREATE", "Cargo.UPDATE"]) */
  appliesTo: string[];
}

export const SuggestedGuardSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  appliesTo: z.array(z.string().min(1)),
});

// ============================================================================
// Design Preferences
// ============================================================================

/**
 * Design preferences for visual styling
 */
export interface DesignPreferences {
  /** Design style */
  style?: "minimal" | "modern" | "playful" | "data-driven" | "immersive";
  /** Primary color (hex) */
  primaryColor?: string;
  /** Target device */
  device?: "mobile" | "tablet" | "desktop" | "all";
  /** Dark mode */
  darkMode?: boolean;
  /** UX hints for pattern selection */
  uxHints?: UXHints;
}

export const DesignPreferencesSchema = z.object({
  style: z
    .enum(["minimal", "modern", "playful", "data-driven", "immersive"])
    .optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be valid hex color")
    .optional(),
  device: z.enum(["mobile", "tablet", "desktop", "all"]).optional(),
  darkMode: z.boolean().optional(),
  uxHints: UXHintsSchema.optional(),
});

// ============================================================================
// Theme Definition
// ============================================================================

/**
 * Theme tokens - CSS custom properties for design system.
 */
export interface ThemeTokens {
  /** Color tokens (e.g., primary, background, foreground) */
  colors?: Record<string, string>;
  /** Border radius tokens */
  radii?: Record<string, string>;
  /** Spacing tokens */
  spacing?: Record<string, string>;
  /** Typography tokens */
  typography?: Record<string, string>;
  /** Shadow tokens */
  shadows?: Record<string, string>;
}

export const ThemeTokensSchema = z.object({
  colors: z.record(z.string(), z.string()).optional(),
  radii: z.record(z.string(), z.string()).optional(),
  spacing: z.record(z.string(), z.string()).optional(),
  typography: z.record(z.string(), z.string()).optional(),
  shadows: z.record(z.string(), z.string()).optional(),
});

/**
 * Theme variant - overrides for a specific mode (e.g., dark mode).
 */
export interface ThemeVariant {
  /** Color overrides */
  colors?: Record<string, string>;
  /** Radius overrides */
  radii?: Record<string, string>;
  /** Spacing overrides */
  spacing?: Record<string, string>;
  /** Typography overrides */
  typography?: Record<string, string>;
  /** Shadow overrides */
  shadows?: Record<string, string>;
}

export const ThemeVariantSchema = z.object({
  colors: z.record(z.string(), z.string()).optional(),
  radii: z.record(z.string(), z.string()).optional(),
  spacing: z.record(z.string(), z.string()).optional(),
  typography: z.record(z.string(), z.string()).optional(),
  shadows: z.record(z.string(), z.string()).optional(),
});

/**
 * Theme definition - design system for an orbital.
 */
export interface ThemeDefinition {
  /** Theme name */
  name: string;
  /** Base tokens */
  tokens: ThemeTokens;
  /** Named variants (e.g., "dark", "high-contrast") */
  variants?: Record<string, ThemeVariant>;
}

export const ThemeDefinitionSchema = z.object({
  name: z.string().min(1, "Theme name is required"),
  tokens: ThemeTokensSchema,
  variants: z.record(z.string(), ThemeVariantSchema).optional(),
});

/**
 * ThemeRef - Theme can be inline definition OR reference to imported theme.
 *
 * Reference format: "Alias.theme"
 */
export type ThemeRef = ThemeDefinition | string;

/**
 * Check if ThemeRef is a reference string.
 */
export function isThemeReference(theme: ThemeRef): theme is string {
  return typeof theme === "string";
}

/**
 * Validate theme reference format: "Alias.theme"
 */
export const ThemeRefStringSchema = z
  .string()
  .regex(
    /^[A-Z][a-zA-Z0-9]*\.theme$/,
    'Theme reference must be in format "Alias.theme" (e.g., "Ocean.theme")',
  );

export const ThemeRefSchema = z.union([
  ThemeDefinitionSchema,
  ThemeRefStringSchema,
]);

// ============================================================================
// Design Tokens (Legacy)
// ============================================================================

/**
 * Design tokens - reusable Tailwind class collections.
 * @deprecated Use ThemeDefinition instead for new code.
 *
 * Instead of repeating raw Tailwind classes everywhere, define once and reference by name.
 * Example: `token: "surfaces.glass"` resolves to the Tailwind classes defined here.
 */
export interface DesignTokens {
  /** Surface styles: backgrounds, borders, shadows */
  surfaces?: Record<string, string>;
  /** Text styles: typography, colors */
  text?: Record<string, string>;
  /** Interactive element styles: buttons, links */
  interactive?: Record<string, string>;
  /** Effect styles: shadows, animations, transitions */
  effects?: Record<string, string>;
  /** Additional custom categories */
  [category: string]: Record<string, string> | undefined;
}

export const DesignTokensSchema = z
  .record(z.string(), z.record(z.string(), z.string()))
  .optional();

// ============================================================================
// Custom Pattern Definitions
// ============================================================================

/**
 * Allowed HTML elements for custom patterns.
 * These are safe, semantic elements for building custom UIs.
 */
export const ALLOWED_CUSTOM_COMPONENTS = [
  "div",
  "span",
  "button",
  "a",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "footer",
  "section",
  "article",
  "nav",
  "main",
  "aside",
  "ul",
  "ol",
  "li",
  "img",
  "label",
  "input",
  "form",
] as const;

export type AllowedCustomComponent = (typeof ALLOWED_CUSTOM_COMPONENTS)[number];

/**
 * Custom pattern definition for app-specific reusable patterns.
 *
 * Register custom designs that can be referenced by name throughout the schema.
 */
export interface CustomPatternDefinition {
  /** Always 'custom' for custom patterns */
  type: "custom";
  /** HTML element to render */
  component: AllowedCustomComponent;
  /** Base Tailwind classes (can include {prop} placeholders) */
  className: string;
  /** Named content slots for nested content */
  slots?: string[];
  /** Configurable props that can be passed when using the pattern */
  props?: string[];
}

export const CustomPatternDefinitionSchema = z.object({
  type: z.literal("custom"),
  component: z.enum(ALLOWED_CUSTOM_COMPONENTS),
  className: z.string(),
  slots: z.array(z.string()).optional(),
  props: z.array(z.string()).optional(),
});

/**
 * Map of custom pattern names to their definitions.
 */
export type CustomPatternMap = Record<string, CustomPatternDefinition>;

export const CustomPatternMapSchema = z
  .record(z.string(), CustomPatternDefinitionSchema)
  .optional();

// ============================================================================
// Type exports
// ============================================================================

export type DomainContextInput = z.input<typeof DomainContextSchema>;
export type DesignPreferencesInput = z.input<typeof DesignPreferencesSchema>;
export type UserPersonaInput = z.input<typeof UserPersonaSchema>;
export type DesignTokensInput = z.input<typeof DesignTokensSchema>;
export type CustomPatternDefinitionInput = z.input<
  typeof CustomPatternDefinitionSchema
>;
export type CustomPatternMapInput = z.input<typeof CustomPatternMapSchema>;
