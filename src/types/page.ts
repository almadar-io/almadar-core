/**
 * Page Types for Orbital Units
 *
 * Defines OrbitalPage type for pages within an Orbital Unit.
 *
 * IMPORTANT: Trait-driven UI architecture requires pages to have traits.
 * Static sections are NO LONGER SUPPORTED.
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import type { PageId, TraitId, EntityId } from './identity.js';
import { PageIdSchema, TraitIdSchema, EntityIdSchema } from './identity.js';
import { TraitConfigSchema, type TraitConfig } from './trait.js';

// ============================================================================
// View Type
// ============================================================================

/**
 * Page view types.
 * Note: viewType may be deprecated in favor of trait-driven UI.
 */
export type ViewType = 'list' | 'detail' | 'create' | 'edit' | 'dashboard' | 'custom';

export const ViewTypeSchema = z.enum([
    'list',
    'detail',
    'create',
    'edit',
    'dashboard',
    'custom',
]);

// ============================================================================
// Trait Reference
// ============================================================================

/**
 * Trait reference on a page.
 */
export interface PageTraitRef {
    /** Trait name from library */
    ref: string;
    /** V4 dual-carry id sibling of `ref` — optional until the Phase-7 flip. */
    refId?: TraitId;
    /** Entity this trait operates on */
    linkedEntity?: string;
    /** V4 dual-carry id sibling of `linkedEntity` — optional until the Phase-7 flip. */
    linkedEntityId?: EntityId;
    /** Additional trait configuration */
    config?: TraitConfig;
}

export const PageTraitRefSchema = z.object({
    ref: z.string().min(1, 'Trait ref is required'),
    refId: TraitIdSchema.optional(),
    linkedEntity: z.string().optional(),
    linkedEntityId: EntityIdSchema.optional(),
    config: TraitConfigSchema.optional(),
});

// ============================================================================
// Orbital Page
// ============================================================================

/**
 * OrbitalPage - a page definition within an Orbital Unit.
 *
 * TRAIT-DRIVEN: Pages must have traits array. Sections are NOT supported.
 */
export interface OrbitalPage {
    /** V4 dual-carry id sibling of `name` — optional until the Phase-7 flip. */
    id?: PageId;

    /** Page name (PascalCase, e.g., "TasksPage") */
    name: string;

    /** URL path (e.g., "/tasks", "/tasks/:id") */
    path: string;

    /** View type (optional in trait-driven mode) */
    viewType?: ViewType;

    /** Page title (optional, defaults to derived from name) */
    title?: string;

    /** Primary entity for this page */
    primaryEntity?: string;

    /**
     * Traits that drive UI for this page.
     * REQUIRED in trait-driven architecture.
     */
    traits?: PageTraitRef[];

    /** Is this the initial page for navigation? */
    isInitial?: boolean;
}

/**
 * Strict Zod schema for trait-driven pages.
 * Rejects unknown properties like 'sections'.
 */
export const OrbitalPageStrictSchema = z.object({
    id: PageIdSchema.optional(),
    name: z.string().min(1, 'Page name is required'),
    path: z.string().min(1, 'Page path is required').startsWith('/', 'Path must start with /'),
    primaryEntity: z.string().min(1, 'Primary entity is required'),
    traits: z.array(PageTraitRefSchema).min(1, 'Page must have at least one trait'),
    title: z.string().optional(),
}).strict(); // Reject unknown keys like 'sections'

/**
 * Zod schema for OrbitalPage.
 * Trait-driven: pages have traits instead of static sections/patterns.
 * Uses .strict() to reject unknown keys like 'sections'.
 */
export const OrbitalPageSchema = z.object({
    id: PageIdSchema.optional(),
    name: z.string().min(1, 'Page name is required'),
    path: z.string().min(1, 'Page path is required').startsWith('/', 'Path must start with /'),
    viewType: ViewTypeSchema.optional(),
    title: z.string().optional(),
    primaryEntity: z.string().optional(),
    traits: z.array(PageTraitRefSchema).optional(),
    isInitial: z.boolean().optional(),
}).strict(); // Reject unknown keys like 'sections' - use traits with render_ui effects

export type OrbitalPageInput = z.input<typeof OrbitalPageSchema>;
export type OrbitalPageStrictInput = z.input<typeof OrbitalPageStrictSchema>;

// ============================================================================
// Type Aliases (for cleaner imports)
// ============================================================================

/** Alias for OrbitalPage - preferred name */
export type Page = OrbitalPage;

/** Alias for OrbitalPageSchema - preferred name */
export const PageSchema = OrbitalPageSchema;
