/**
 * The behavior-contract slice `orbital-lolo` reads at parse time (a behavior package's
 * `loloContracts` sidecar): per behavior, each trait's `entityContract.requires` and overridable
 * config-key types, its page names, orbital-level config and app-level config.
 *
 * Built from a package's own factory-signature catalog(s) and its own `.orb` documents. A behavior
 * with no factory signature (a template, or a behavior a user published from the Studio) takes its
 * slice from its `.orb` alone. Pure: the cascade (`@almadar-io/almadar-pattern-sync`) and the
 * Studio's behavior packages read their files and call this, one copy of the rule.
 */
import { isJsonObject, type JsonObject, type JsonValue } from '../types/json.js';
import { rehydrateKnobDefs } from './knob-defs.js';
import type { FactorySignatureCatalog } from './types.js';

/** One trait's parse-time-checkable contract. Mirrors `TraitContract` in `orbital-lolo/src/registry.rs`. */
export interface LoloTraitContract {
  /** Entity fields the trait reads (`@entity.<field>`); a rebind target must supply all of these. */
  requires: string[];
  /** Overridable config keys → their lolo type. */
  config: Record<string, string>;
}

/** One orbital's parse-time-checkable contract. Mirrors `OrbitalContract` in `orbital-lolo/src/registry.rs`. */
export interface LoloOrbitalContract {
  config: Record<string, string>;
}

/** One behavior's slice. Mirrors `Behavior` in `orbital-lolo/src/registry.rs`. */
export interface LoloBehaviorContract {
  traits: Record<string, LoloTraitContract>;
  pages: string[];
  /** Orbital contracts, keyed by orbital name — the `Alias.orbitals.X` surface. */
  orbitals: Record<string, LoloOrbitalContract>;
  /** App-level (organism-wide) declared config keys → their lolo type. */
  appConfig: Record<string, string>;
}

/** One behavior's `.orb` document, named as its registry file is (`<name>.orb`). */
export interface NamedOrb {
  name: string;
  orb: JsonValue;
}

const JS_TO_LOLO_TYPE: Record<string, string> = {
  string: 'string',
  number: 'number',
  integer: 'number',
  boolean: 'boolean',
  array: 'array',
  object: 'object',
};

function jsToLolo(t: string | undefined): string {
  return JS_TO_LOLO_TYPE[t ?? ''] ?? (t || 'string');
}

/**
 * A declared config knob's lolo type: its explicit `type` when present, else inferred from its
 * `default`'s JS runtime type.
 */
export function inferConfigType(spec: JsonValue | undefined): string | undefined {
  if (spec === undefined || !isJsonObject(spec)) return undefined;
  const explicit = spec['type'];
  if (typeof explicit === 'string' && explicit.length > 0) return explicit;
  const d = spec['default'];
  if (Array.isArray(d)) return 'array';
  if (d === null || d === undefined) return undefined;
  return typeof d;
}

/** Recursively sort object keys so emitted JSON is byte-stable across runs. */
export function sortKeysDeep(v: JsonValue): JsonValue {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (isJsonObject(v)) {
    const out: JsonObject = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeysDeep(v[k] ?? null);
    return out;
  }
  return v;
}

const objectsOf = (v: JsonValue | undefined): JsonObject[] => (Array.isArray(v) ? v.filter(isJsonObject) : []);
const objectOf = (v: JsonValue | undefined): JsonObject => (v !== undefined && isJsonObject(v) ? v : {});
const stringsOf = (v: JsonValue | undefined): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function configTypes(config: JsonValue | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, spec] of Object.entries(objectOf(config))) out[key] = jsToLolo(inferConfigType(spec));
  return out;
}

export function buildLoloBehaviorContracts(
  catalogs: readonly FactorySignatureCatalog[],
  orbs: readonly NamedOrb[],
): Record<string, LoloBehaviorContract> {
  const behaviors: Record<string, LoloBehaviorContract> = {};
  const entryFor = (name: string): LoloBehaviorContract => (behaviors[name] ??= { traits: {}, pages: [], orbitals: {}, appConfig: {} });

  // A multi-orbital behavior has one signature per orbital, all sharing its `organism`: merge them,
  // first match winning on a trait-name collision (as the compiler's resolver does).
  for (const raw of catalogs) {
    const catalog = rehydrateKnobDefs(raw);
    for (const s of catalog.signatures) {
      if (!s.organism) continue;
      const entry = entryFor(s.organism);
      for (const t of s.traits) {
        if (t.name in entry.traits) continue;
        const config: Record<string, string> = {};
        for (const ck of t.overridableConfigKeys ?? []) {
          if (ck?.key) config[ck.key] = jsToLolo(ck.type);
        }
        entry.traits[t.name] = { requires: [...(t.entityContract?.requires ?? [])], config };
      }
      for (const p of s.pages) {
        if (p?.name && !entry.pages.includes(p.name)) entry.pages.push(p.name);
      }
    }
  }
  for (const entry of Object.values(behaviors)) entry.pages.sort();

  // No factory signature: the slice comes from the `.orb` itself.
  for (const { name, orb } of orbs) {
    if (behaviors[name]) continue;
    const traits: Record<string, LoloTraitContract> = {};
    const pages: string[] = [];
    for (const orbital of objectsOf(objectOf(orb)['orbitals'])) {
      for (const t of objectsOf(orbital['traits'])) {
        const traitName = t['name'];
        if (typeof traitName !== 'string') continue;
        traits[traitName] = { requires: stringsOf(objectOf(t['entityContract'])['requires']), config: configTypes(t['config']) };
      }
      for (const p of objectsOf(orbital['pages'])) {
        if (typeof p['name'] === 'string' && p['name']) pages.push(p['name']);
      }
    }
    behaviors[name] = { traits, pages, orbitals: {}, appConfig: {} };
  }

  // Orbital- and app-level config knobs come straight off every `.orb`.
  for (const { name, orb } of orbs) {
    const target = entryFor(name);
    const doc = objectOf(orb);
    Object.assign(target.appConfig, configTypes(doc['config']));
    for (const orbital of objectsOf(doc['orbitals'])) {
      const orbitalName = orbital['name'];
      if (typeof orbitalName !== 'string' || !orbitalName) continue;
      target.orbitals[orbitalName] = { config: configTypes(orbital['config']) };
    }
  }

  return behaviors;
}

/** The sidecar file's content: `{ behaviors }`, key-sorted. */
export function serializeLoloBehaviorContracts(behaviors: Record<string, LoloBehaviorContract>): string {
  const doc: JsonObject = {};
  for (const [name, b] of Object.entries(behaviors)) {
    const traits: JsonObject = {};
    for (const [t, c] of Object.entries(b.traits)) traits[t] = { requires: c.requires, config: c.config };
    const orbitals: JsonObject = {};
    for (const [o, c] of Object.entries(b.orbitals)) orbitals[o] = { config: c.config };
    doc[name] = { traits, pages: b.pages, orbitals, appConfig: b.appConfig };
  }
  return JSON.stringify(sortKeysDeep({ behaviors: doc }));
}
