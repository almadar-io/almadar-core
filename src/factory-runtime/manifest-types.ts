/**
 * Orbital factory manifest types — shared across all packages.
 *
 * These types describe the param surface of a generated per-orbital factory.
 * Previously defined inline in each generated `dispatch.ts`; lifted to core so
 * `factory-runtime` can import them without a circular dep on generated code.
 *
 * @packageDocumentation
 */

export interface ParamFieldDescriptor {
  name: string;
  type: string;
  description: string;
}

export interface OrbitalParamsManifest {
  organism: string;
  orbitalName: string;
  paramFields: readonly ParamFieldDescriptor[];
  traitNames: readonly string[];
  inlineTraitNames: readonly string[];
}
