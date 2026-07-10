/**
 * Embedded-trait config resolution — shared by the JS interpreter
 * (`@almadar/runtime`) and the render substrate (`@almadar/ui`).
 *
 * A molecule's inline sub-trait (e.g. `std-browse`'s `DataGrid1`) authors
 * `config { fields: @config.fields }` — a forward meaning "read MY
 * embedder's `config.fields`". That's a lexical-scope reference in the
 * atom's own `.lolo`; once the molecule is flattened (the compiled path's
 * `orbital resolve`, or the JS resolvers in `@almadar/runtime`) the embedder
 * is no longer an enclosing scope, just a sibling trait in `orbital.traits[]`.
 * Left unresolved, the literal string `"@config.fields"` becomes the
 * sub-trait's own `@config.fields` binding value — components consuming it
 * (e.g. `DataGrid`'s `fieldDefs.find`) receive a string instead of an array
 * and throw.
 *
 * `buildResolvedTraitConfigs` chains those forwards through to the trait
 * that actually embeds each one (found via `@trait.X` literals, the same
 * shape `collectEmbeddedTraits`-style walkers look for), recursively when
 * the referrer is itself an embedded sub-trait one level up.
 *
 * @packageDocumentation
 */
import type { OrbitalDefinition, OrbitalSchema, SExpr, SExprAtom, Trait, TraitConfig, TraitConfigValue, TraitRef } from './types/index.js';
import { normalizeCallSiteConfigToValues } from './types/index.js';

const TRAIT_BINDING_PREFIX = '@trait.';
const CONFIG_FORWARD_RE = /^@config\.([A-Za-z_][A-Za-z0-9_]*)$/;

function collectTraitRefsFromValue(value: SExpr, into: Set<string>): void {
  if (value === null || value === undefined) return;
  if (typeof value === 'string') {
    if (value.startsWith(TRAIT_BINDING_PREFIX)) {
      const rest = value.slice(TRAIT_BINDING_PREFIX.length);
      const dot = rest.indexOf('.');
      const traitName = dot === -1 ? rest : rest.slice(0, dot);
      if (traitName.length > 0) into.add(traitName);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectTraitRefsFromValue(item, into);
    return;
  }
  if (typeof value === 'object') {
    for (const v of Object.values(value as SExprAtom & Record<string, SExpr>)) {
      collectTraitRefsFromValue(v, into);
    }
  }
}

/** Resolve a `TraitRef` entry to its target `Trait` — unwraps the runtime
 *  resolver's `{ ref, config, _resolved }` wrapper when present; otherwise
 *  the entry is already a plain inline `Trait` (the compiled path's shape). */
function targetTraitOf(traitRef: TraitRef): Trait | undefined {
  if (!traitRef || typeof traitRef !== 'object') return undefined;
  const resolved = (traitRef as TraitRef & { _resolved?: Trait })._resolved;
  return (resolved && typeof resolved === 'object') ? resolved : (traitRef as Trait);
}

/**
 * Build the childTraitName → referrerTraitName map: for every trait whose
 * config literally contains `@trait.X`, record `X -> thisTrait`. First
 * referrer wins per child — today's compositions embed a given trait from
 * exactly one referrer.
 *
 * Safe to call on the resolved (post-inline) schema. Memoize by reference.
 */
export function collectEmbeddedTraitReferrers(
  schema: OrbitalSchema | undefined | null,
): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  if (!schema?.orbitals) return out;
  for (const orbital of schema.orbitals as OrbitalDefinition[]) {
    const traits: TraitRef[] = orbital.traits;
    if (!Array.isArray(traits)) continue;
    for (const traitRef of traits) {
      const target = targetTraitOf(traitRef);
      if (!target) continue;
      const referrerName = target.name;
      if (typeof referrerName !== 'string' || referrerName.length === 0) continue;
      if (!target.config) continue;
      const refs = new Set<string>();
      collectTraitRefsFromValue(target.config, refs);
      for (const child of refs) {
        if (child === referrerName) continue;
        if (!out.has(child)) out.set(child, referrerName);
      }
    }
  }
  return out;
}

/**
 * Build the trait-name → resolved-`TraitConfig` map for a schema: each
 * trait's raw call-site config, normalized to plain values, with any
 * `@config.<key>` forward chained through to the referrer that actually
 * embeds it (recursively, with a cycle guard).
 */
export function buildResolvedTraitConfigs(
  schema: OrbitalSchema | undefined | null,
): Record<string, TraitConfig> {
  const rawByName: Record<string, TraitRef & { config?: unknown }> = {};
  if (!schema?.orbitals) return {};
  for (const orbital of schema.orbitals as OrbitalDefinition[]) {
    const traitRefs: TraitRef[] | undefined = orbital.traits;
    if (!traitRefs) continue;
    for (const t of traitRefs) {
      if (typeof t === 'string') continue;
      const name = (t as { name?: string; ref?: string }).name ?? (t as { ref?: string }).ref;
      const config = (t as { config?: unknown }).config;
      if (typeof name === 'string' && config !== undefined) {
        rawByName[name] = { ...(t as object), config } as TraitRef & { config?: unknown };
      }
    }
  }

  const referrerByChild = collectEmbeddedTraitReferrers(schema);
  const resolved = new Map<string, TraitConfig>();
  const resolving = new Set<string>();

  function resolveConfig(name: string): TraitConfig | undefined {
    const cached = resolved.get(name);
    if (cached) return cached;
    const raw = rawByName[name]?.config as Parameters<typeof normalizeCallSiteConfigToValues>[0];
    const base = normalizeCallSiteConfigToValues(raw);
    if (!base) return undefined;
    // Cycle guard: a referrer chain can't legitimately loop back to
    // itself; bail to the unresolved forward rather than recurse forever.
    if (resolving.has(name)) return base;
    resolving.add(name);
    const out: Record<string, TraitConfigValue> = { ...base };
    const referrer = referrerByChild.get(name);
    if (referrer && referrer !== name) {
      const referrerConfig = resolveConfig(referrer);
      for (const [key, value] of Object.entries(out)) {
        if (typeof value !== 'string') continue;
        const match = CONFIG_FORWARD_RE.exec(value);
        if (!match) continue;
        const forwarded = referrerConfig?.[match[1]];
        if (forwarded !== undefined) out[key] = forwarded;
      }
    }
    resolving.delete(name);
    resolved.set(name, out);
    return out;
  }

  const map: Record<string, TraitConfig> = {};
  for (const name of Object.keys(rawByName)) {
    const cfg = resolveConfig(name);
    if (cfg !== undefined) map[name] = cfg;
  }
  return map;
}
