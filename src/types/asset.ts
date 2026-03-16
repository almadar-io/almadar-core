/**
 * Asset Types for Semantic Asset References
 *
 * Defines types for abstracting asset paths into semantic references.
 * Assets are resolved from SemanticAssetRef to actual paths at compile time.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

// ============================================================================
// Entity Roles
// ============================================================================

/**
 * Entity roles in game contexts
 */
export const ENTITY_ROLES = [
    'player',
    'enemy',
    'npc',
    'item',
    'tile',
    'projectile',
    'effect',
    'ui',
    'decoration',
    'vehicle',
] as const;

export type EntityRole = (typeof ENTITY_ROLES)[number];

export const EntityRoleSchema = z.enum(ENTITY_ROLES);

// ============================================================================
// Visual Styles
// ============================================================================

/**
 * Visual art styles for games
 */
export const VISUAL_STYLES = ['pixel', 'vector', 'hd', '1-bit', 'isometric'] as const;

export type VisualStyle = (typeof VISUAL_STYLES)[number];

export const VisualStyleSchema = z.enum(VISUAL_STYLES);

// ============================================================================
// Game Types
// ============================================================================

/**
 * Game type classifications
 */
export const GAME_TYPES = [
    'platformer',
    'roguelike',
    'top-down',
    'puzzle',
    'racing',
    'card',
    'board',
    'shooter',
    'rpg',
] as const;

export type GameType = (typeof GAME_TYPES)[number];

export const GameTypeSchema = z.enum(GAME_TYPES);

// ============================================================================
// Animation Definition
// ============================================================================

/**
 * Animation definition for sprites
 */
export interface AnimationDef {
    /** Frame indices or file names */
    frames: number[] | string[];
    /** Frames per second */
    fps: number;
    /** Whether animation loops */
    loop: boolean;
}

export const AnimationDefSchema = z.object({
    frames: z.union([z.array(z.number()), z.array(z.string())]),
    fps: z.number().positive(),
    loop: z.boolean(),
});

// ============================================================================
// Semantic Asset Reference
// ============================================================================

/**
 * Semantic reference to an asset (not a hardcoded path).
 * Resolved to actual paths at compile time via asset maps.
 */
export interface SemanticAssetRef {
    /** Entity role (player, enemy, item, etc.) */
    role: EntityRole;
    /** Sub-category within role (hero, slime, coin, etc.) */
    category: string;
    /** Required animations for this entity */
    animations?: string[];
    /** Visual style preference */
    style?: VisualStyle;
    /** Variant identifier (for multiple versions) */
    variant?: string;
}

export const SemanticAssetRefSchema = z.object({
    role: EntityRoleSchema,
    category: z.string().min(1),
    animations: z.array(z.string()).optional(),
    style: VisualStyleSchema.optional(),
    variant: z.string().optional(),
});

// ============================================================================
// Resolved Asset
// ============================================================================

/**
 * Result of resolving a SemanticAssetRef to actual asset paths
 */
export interface ResolvedAsset {
    /** Base path to the asset pack */
    basePath: string;
    /** Relative path within the pack */
    path: string;
    /** Tile indices for tilesheet-based assets */
    tiles?: number[];
    /** Size of each tile in pixels */
    tileSize?: number;
    /** List of individual files (for non-tilesheet assets) */
    files?: string[];
    /** Animation definitions by name */
    animations?: Record<string, AnimationDef>;
}

export const ResolvedAssetSchema = z.object({
    basePath: z.string(),
    path: z.string(),
    tiles: z.array(z.number()).optional(),
    tileSize: z.number().positive().optional(),
    files: z.array(z.string()).optional(),
    animations: z.record(AnimationDefSchema).optional(),
});

// ============================================================================
// Asset Mapping
// ============================================================================

/**
 * Single asset mapping entry in an asset map
 */
export interface AssetMapping {
    /** Relative path to the asset */
    path: string;
    /** Tile indices for tilesheets */
    tiles?: number[];
    /** Tile size in pixels */
    tileSize?: number;
    /** Individual file patterns */
    files?: string[];
    /** Animation definitions */
    animations?: Record<string, AnimationDef>;
}

export const AssetMappingSchema = z.object({
    path: z.string(),
    tiles: z.array(z.number()).optional(),
    tileSize: z.number().positive().optional(),
    files: z.array(z.string()).optional(),
    animations: z.record(AnimationDefSchema).optional(),
});

// ============================================================================
// Asset Map
// ============================================================================

/**
 * Asset map for a specific game type and visual style.
 * Maps semantic keys (role:category) to asset paths.
 */
export interface AssetMap {
    /** Game type this map is for */
    gameType: GameType;
    /** Visual style this map is for */
    style: VisualStyle;
    /** Base path to the asset pack */
    basePath: string;
    /** Mappings from semantic keys to asset paths */
    mappings: Record<string, AssetMapping>;
}

export const AssetMapSchema = z.object({
    gameType: GameTypeSchema,
    style: VisualStyleSchema,
    basePath: z.string(),
    mappings: z.record(AssetMappingSchema),
});

// ============================================================================
// Type Exports
// ============================================================================

export type SemanticAssetRefInput = z.input<typeof SemanticAssetRefSchema>;
export type ResolvedAssetInput = z.input<typeof ResolvedAssetSchema>;
export type AssetMappingInput = z.input<typeof AssetMappingSchema>;
export type AssetMapInput = z.input<typeof AssetMapSchema>;
export type AnimationDefInput = z.input<typeof AnimationDefSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a semantic asset key from role and category.
 * 
 * Generates a unique asset identifier by combining role and category
 * with a colon separator. Used for asset management and lookup.
 * 
 * @param {EntityRole} role - Entity role (e.g., 'player', 'enemy')
 * @param {string} category - Asset category (e.g., 'sprite', 'animation')
 * @returns {string} Asset key in format 'role:category'
 * 
 * @example
 * createAssetKey('player', 'sprite'); // returns 'player:sprite'
 * createAssetKey('enemy', 'animation'); // returns 'enemy:animation'
 */
export function createAssetKey(role: EntityRole, category: string): string {
    return `${role}:${category}`;
}

/**
 * Parses an asset key into role and category components.
 * 
 * Deconstructs an asset key string (format 'role:category') into its
 * constituent parts. Returns null if the key format is invalid.
 * 
 * @param {string} key - Asset key in format 'role:category'
 * @returns {{ role: string; category: string } | null} Parsed components or null
 * 
 * @example
 * parseAssetKey('player:sprite'); // returns { role: 'player', category: 'sprite' }
 * parseAssetKey('enemy:animation'); // returns { role: 'enemy', category: 'animation' }
 * parseAssetKey('invalid'); // returns null
 */
export function parseAssetKey(key: string): { role: string; category: string } | null {
    const parts = key.split(':');
    if (parts.length !== 2) return null;
    return { role: parts[0], category: parts[1] };
}

/**
 * Gets common animations for an entity role.
 * 
 * Returns an array of default animation names appropriate for the
 * specified entity role. Used for asset configuration and validation.
 * 
 * @param {EntityRole} role - Entity role
 * @returns {string[]} Array of default animation names
 * 
 * @example
 * getDefaultAnimationsForRole('player'); // returns ['idle', 'run', 'jump', 'fall', 'attack', 'hurt', 'die']
 * getDefaultAnimationsForRole('enemy'); // returns ['idle', 'walk', 'attack', 'hurt', 'die']
 */
export function getDefaultAnimationsForRole(role: EntityRole): string[] {
    switch (role) {
        case 'player':
            return ['idle', 'run', 'jump', 'fall', 'attack', 'hurt', 'die'];
        case 'enemy':
            return ['idle', 'walk', 'attack', 'hurt', 'die'];
        case 'npc':
            return ['idle', 'walk', 'talk'];
        case 'item':
            return ['idle', 'collected'];
        case 'tile':
            return ['static'];
        case 'projectile':
            return ['fly', 'hit', 'expire'];
        case 'effect':
            return ['play'];
        case 'ui':
            return ['normal', 'hover', 'pressed', 'disabled'];
        case 'decoration':
            return ['idle'];
        case 'vehicle':
            return ['idle', 'move', 'brake'];
        default:
            return ['idle'];
    }
}

/**
 * Validates that an asset reference has required animations.
 * 
 * Checks if an asset reference contains all required animations.
 * Returns an error message if validation fails, or null if valid.
 * 
 * @param {SemanticAssetRef} assetRef - Asset reference to validate
 * @param {string[]} requiredAnimations - Required animation names
 * @returns {string | null} Error message or null if valid
 * 
 * @example
 * validateAssetAnimations(assetRef, ['idle', 'run']); // returns null if valid
 * validateAssetAnimations(assetRef, ['missing-animation']); // returns error message
 */
export function validateAssetAnimations(
    assetRef: SemanticAssetRef,
    requiredAnimations: string[]
): { valid: boolean; missing: string[] } {
    const provided = assetRef.animations || [];
    const missing = requiredAnimations.filter((anim) => !provided.includes(anim));
    return { valid: missing.length === 0, missing };
}
