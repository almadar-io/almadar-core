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
// Agent Domain Categories (simplified for LLM-based tools)
// ============================================================================

/**
 * Simplified domain categories used by the agent tools for application classification.
 * All agent tools and skill generators should derive from this constant.
 */
export const AGENT_DOMAIN_CATEGORIES = [
  "game",
  "business",
  "dashboard",
  "form",
  "content",
  "social",
  "ecommerce",
  "workflow",
] as const;

export type AgentDomainCategory = (typeof AGENT_DOMAIN_CATEGORIES)[number];

export const AgentDomainCategorySchema = z.enum([...AGENT_DOMAIN_CATEGORIES]);

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
  category: AgentDomainCategory;
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
  category: AgentDomainCategorySchema,
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
// Theme Definition — Skin axes (Layer 1 visual variation, see docs/Almadar_Std_Variations.md)
// ============================================================================

/** Spacing scale entry — each step pairs with a CSS `--space-N` variable */
export interface SpacingScale {
  space0?: string;
  space1?: string;
  space2?: string;
  space3?: string;
  space4?: string;
  space5?: string;
  space6?: string;
  space7?: string;
  space8?: string;
  space9?: string;
  space10?: string;
  space11?: string;
  space12?: string;
}

export const SpacingScaleSchema = z.object({
  space0: z.string().optional(),
  space1: z.string().optional(),
  space2: z.string().optional(),
  space3: z.string().optional(),
  space4: z.string().optional(),
  space5: z.string().optional(),
  space6: z.string().optional(),
  space7: z.string().optional(),
  space8: z.string().optional(),
  space9: z.string().optional(),
  space10: z.string().optional(),
  space11: z.string().optional(),
  space12: z.string().optional(),
});

/**
 * Density axis — spacing rhythm + per-element heights and paddings.
 * Determines whether a UI feels compact (Linear), cozy (default), or spacious (Notion).
 */
export interface DensityTokens {
  spacing?: SpacingScale;
  buttonHeightSm?: string;
  buttonHeightMd?: string;
  buttonHeightLg?: string;
  inputHeightSm?: string;
  inputHeightMd?: string;
  inputHeightLg?: string;
  rowHeightCompact?: string;
  rowHeightNormal?: string;
  rowHeightSpacious?: string;
  cardPaddingSm?: string;
  cardPaddingMd?: string;
  cardPaddingLg?: string;
  dialogPadding?: string;
  sectionGap?: string;
}

export const DensityTokensSchema = z.object({
  spacing: SpacingScaleSchema.optional(),
  buttonHeightSm: z.string().optional(),
  buttonHeightMd: z.string().optional(),
  buttonHeightLg: z.string().optional(),
  inputHeightSm: z.string().optional(),
  inputHeightMd: z.string().optional(),
  inputHeightLg: z.string().optional(),
  rowHeightCompact: z.string().optional(),
  rowHeightNormal: z.string().optional(),
  rowHeightSpacious: z.string().optional(),
  cardPaddingSm: z.string().optional(),
  cardPaddingMd: z.string().optional(),
  cardPaddingLg: z.string().optional(),
  dialogPadding: z.string().optional(),
  sectionGap: z.string().optional(),
});

/** Single entry in the type scale — size + matching line-height */
export interface TypeScaleEntry {
  size: string;
  lineHeight: string;
}

export const TypeScaleEntrySchema = z.object({
  size: z.string(),
  lineHeight: z.string(),
});

/** Type slot (which family the intent renders in) */
export type TypeSlot = "display" | "body" | "mono";

export const TypeSlotSchema = z.enum(["display", "body", "mono"]);

/** Type size key from the scale */
export type TypeSizeKey =
  | "xs"
  | "sm"
  | "base"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "4xl"
  | "display-1"
  | "display-2";

export const TypeSizeKeySchema = z.enum([
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "display-1",
  "display-2",
]);

/** Type weight key */
export type TypeWeight = "normal" | "medium" | "bold";

export const TypeWeightSchema = z.enum(["normal", "medium", "bold"]);

/** Intent → (slot, size, weight) mapping. Authors write intent in render-ui; skin resolves. */
export interface TypeIntent {
  slot: TypeSlot;
  size: TypeSizeKey;
  weight: TypeWeight;
}

export const TypeIntentSchema = z.object({
  slot: TypeSlotSchema,
  size: TypeSizeKeySchema,
  weight: TypeWeightSchema,
});

export interface TypeScale {
  xs?: TypeScaleEntry;
  sm?: TypeScaleEntry;
  base?: TypeScaleEntry;
  lg?: TypeScaleEntry;
  xl?: TypeScaleEntry;
  "2xl"?: TypeScaleEntry;
  "3xl"?: TypeScaleEntry;
  "4xl"?: TypeScaleEntry;
  "display-1"?: TypeScaleEntry;
  "display-2"?: TypeScaleEntry;
}

export const TypeScaleSchema = z.object({
  xs: TypeScaleEntrySchema.optional(),
  sm: TypeScaleEntrySchema.optional(),
  base: TypeScaleEntrySchema.optional(),
  lg: TypeScaleEntrySchema.optional(),
  xl: TypeScaleEntrySchema.optional(),
  "2xl": TypeScaleEntrySchema.optional(),
  "3xl": TypeScaleEntrySchema.optional(),
  "4xl": TypeScaleEntrySchema.optional(),
  "display-1": TypeScaleEntrySchema.optional(),
  "display-2": TypeScaleEntrySchema.optional(),
});

export interface TypeIntentMap {
  headingMajor?: TypeIntent;
  headingMinor?: TypeIntent;
  bodyEmphasis?: TypeIntent;
  bodyDefault?: TypeIntent;
  bodyQuiet?: TypeIntent;
  caption?: TypeIntent;
  numeric?: TypeIntent;
}

export const TypeIntentMapSchema = z.object({
  headingMajor: TypeIntentSchema.optional(),
  headingMinor: TypeIntentSchema.optional(),
  bodyEmphasis: TypeIntentSchema.optional(),
  bodyDefault: TypeIntentSchema.optional(),
  bodyQuiet: TypeIntentSchema.optional(),
  caption: TypeIntentSchema.optional(),
  numeric: TypeIntentSchema.optional(),
});

/**
 * Type axis — family triplet, size scale, and intent mapping.
 * Determines whether a UI reads as editorial (serif display + sans body),
 * tech (sans + mono numeric), or dense (mono everywhere, tight leading).
 */
export interface TypeScaleTokens {
  displayFamily?: string;
  bodyFamily?: string;
  monoFamily?: string;
  scale?: TypeScale;
  intents?: TypeIntentMap;
}

export const TypeScaleTokensSchema = z.object({
  displayFamily: z.string().optional(),
  bodyFamily: z.string().optional(),
  monoFamily: z.string().optional(),
  scale: TypeScaleSchema.optional(),
  intents: TypeIntentMapSchema.optional(),
});

/** Duration palette key */
export type MotionDurationKey =
  | "instant"
  | "fast"
  | "normal"
  | "slow"
  | "dramatic";

export const MotionDurationKeySchema = z.enum([
  "instant",
  "fast",
  "normal",
  "slow",
  "dramatic",
]);

/** Easing palette key */
export type MotionEasingKey = "linear" | "standard" | "emphasized" | "spring";

export const MotionEasingKeySchema = z.enum([
  "linear",
  "standard",
  "emphasized",
  "spring",
]);

/** Per-intent motion specification (duration + easing) */
export interface MotionIntent {
  duration: MotionDurationKey;
  easing: MotionEasingKey;
}

export const MotionIntentSchema = z.object({
  duration: MotionDurationKeySchema,
  easing: MotionEasingKeySchema,
});

export interface MotionDurationPalette {
  instant?: string;
  fast?: string;
  normal?: string;
  slow?: string;
  dramatic?: string;
}

export const MotionDurationPaletteSchema = z.object({
  instant: z.string().optional(),
  fast: z.string().optional(),
  normal: z.string().optional(),
  slow: z.string().optional(),
  dramatic: z.string().optional(),
});

export interface MotionEasingPalette {
  linear?: string;
  standard?: string;
  emphasized?: string;
  spring?: string;
}

export const MotionEasingPaletteSchema = z.object({
  linear: z.string().optional(),
  standard: z.string().optional(),
  emphasized: z.string().optional(),
  spring: z.string().optional(),
});

export interface MotionIntentMap {
  enter?: MotionIntent;
  exit?: MotionIntent;
  hover?: MotionIntent;
  press?: MotionIntent;
  expand?: MotionIntent;
  transition?: MotionIntent;
}

export const MotionIntentMapSchema = z.object({
  enter: MotionIntentSchema.optional(),
  exit: MotionIntentSchema.optional(),
  hover: MotionIntentSchema.optional(),
  press: MotionIntentSchema.optional(),
  expand: MotionIntentSchema.optional(),
  transition: MotionIntentSchema.optional(),
});

/**
 * Motion axis — duration palette + easing palette + per-intent mapping.
 * Mechanical (linear, fast) vs organic (cubic-bezier, medium) vs dramatic (spring, slow).
 */
export interface MotionTokens {
  durations?: MotionDurationPalette;
  easings?: MotionEasingPalette;
  intents?: MotionIntentMap;
}

export const MotionTokensSchema = z.object({
  durations: MotionDurationPaletteSchema.optional(),
  easings: MotionEasingPaletteSchema.optional(),
  intents: MotionIntentMapSchema.optional(),
});

/** Icon family selector */
export type IconFamily =
  | "lucide"
  | "phosphor-outline"
  | "phosphor-fill"
  | "phosphor-duotone"
  | "tabler"
  | "fa-solid";

export const IconFamilySchema = z.enum([
  "lucide",
  "phosphor-outline",
  "phosphor-fill",
  "phosphor-duotone",
  "tabler",
  "fa-solid",
]);

/**
 * Iconography axis — icon set + stroke + default size.
 * Outline (Lucide) vs filled (Phosphor-fill) vs duotone (Phosphor-duotone).
 */
export interface IconographyTokens {
  family?: IconFamily;
  strokeWidth?: string;
  defaultSize?: string;
}

export const IconographyTokensSchema = z.object({
  family: IconFamilySchema.optional(),
  strokeWidth: z.string().optional(),
  defaultSize: z.string().optional(),
});

/**
 * Elevation axis — per-layer shadow mapping.
 * Each value references a `--shadow-*` token or a raw CSS shadow value.
 */
export interface ElevationTokens {
  cardElevation?: string;
  popoverElevation?: string;
  dialogElevation?: string;
  toastElevation?: string;
}

export const ElevationTokensSchema = z.object({
  cardElevation: z.string().optional(),
  popoverElevation: z.string().optional(),
  dialogElevation: z.string().optional(),
  toastElevation: z.string().optional(),
});

/**
 * Geometry axis — radius rhythm + border-width rhythm with intent.
 * Sharp (radius 0) vs soft (radius 8/12) vs pill (radius full on interactive).
 */
export interface GeometryTokens {
  radiusContainer?: string;
  radiusInteractive?: string;
  radiusPill?: string;
  borderHairline?: string;
  borderStandard?: string;
  borderHeavy?: string;
}

export const GeometryTokensSchema = z.object({
  radiusContainer: z.string().optional(),
  radiusInteractive: z.string().optional(),
  radiusPill: z.string().optional(),
  borderHairline: z.string().optional(),
  borderStandard: z.string().optional(),
  borderHeavy: z.string().optional(),
});

/**
 * Theme tokens - CSS custom properties for design system.
 *
 * Layer 1 visual variation (see docs/Almadar_Std_Variations.md): the original
 * `colors`/`radii`/`spacing`/`typography`/`shadows` Record fields are kept for
 * backward compatibility. The new typed axes (`density`, `typeScale`, `motion`,
 * `iconography`, `elevation`, `geometry`) carry the structured token surface
 * that lets two themes feel like different products, not just different paint.
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
  /** Density axis — spacing rhythm, per-element heights and paddings */
  density?: DensityTokens;
  /** Type axis — family triplet, scale, intent mapping */
  typeScale?: TypeScaleTokens;
  /** Motion axis — duration palette, easing palette, intent mapping */
  motion?: MotionTokens;
  /** Iconography axis — icon family, stroke, default size */
  iconography?: IconographyTokens;
  /** Elevation axis — per-layer shadow mapping */
  elevation?: ElevationTokens;
  /** Geometry axis — radius rhythm, border-width rhythm with intent */
  geometry?: GeometryTokens;
}

export const ThemeTokensSchema = z.object({
  colors: z.record(z.string(), z.string()).optional(),
  radii: z.record(z.string(), z.string()).optional(),
  spacing: z.record(z.string(), z.string()).optional(),
  typography: z.record(z.string(), z.string()).optional(),
  shadows: z.record(z.string(), z.string()).optional(),
  density: DensityTokensSchema.optional(),
  typeScale: TypeScaleTokensSchema.optional(),
  motion: MotionTokensSchema.optional(),
  iconography: IconographyTokensSchema.optional(),
  elevation: ElevationTokensSchema.optional(),
  geometry: GeometryTokensSchema.optional(),
});

/**
 * Theme variant - overrides for a specific mode (e.g., dark mode).
 * Mirrors ThemeTokens fields with the same backward-compat + new-axis structure.
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
  /** Density axis overrides */
  density?: DensityTokens;
  /** Type axis overrides */
  typeScale?: TypeScaleTokens;
  /** Motion axis overrides */
  motion?: MotionTokens;
  /** Iconography axis overrides */
  iconography?: IconographyTokens;
  /** Elevation axis overrides */
  elevation?: ElevationTokens;
  /** Geometry axis overrides */
  geometry?: GeometryTokens;
}

export const ThemeVariantSchema = z.object({
  colors: z.record(z.string(), z.string()).optional(),
  radii: z.record(z.string(), z.string()).optional(),
  spacing: z.record(z.string(), z.string()).optional(),
  typography: z.record(z.string(), z.string()).optional(),
  shadows: z.record(z.string(), z.string()).optional(),
  density: DensityTokensSchema.optional(),
  typeScale: TypeScaleTokensSchema.optional(),
  motion: MotionTokensSchema.optional(),
  iconography: IconographyTokensSchema.optional(),
  elevation: ElevationTokensSchema.optional(),
  geometry: GeometryTokensSchema.optional(),
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
 * Checks if a theme reference is a string.
 * 
 * Type guard to determine if a theme reference is a string reference
 * (format: "Alias.theme") rather than an inline theme definition.
 * 
 * @param {ThemeRef} theme - Theme reference to check
 * @returns {boolean} True if theme is a string reference, false otherwise
 * 
 * @example
 * isThemeReference("Ocean.theme"); // returns true
 * isThemeReference({ name: "ocean", colors: {...} }); // returns false
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
