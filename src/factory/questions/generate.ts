/**
 * `generateQuestions(plan, catalog, ruleOverlay?)`.
 *
 * Deterministic, no LLM call. Walks each `FactoryCallSite` in the
 * durable plan against its matching `FactorySignature` and emits one
 * open question per advertised knob the user hasn't already filled.
 *
 * Two families of questions, both source-derived:
 *
 *   1. CONFIG-KEY — one question per
 *      `signature.traits[*].overridableConfigKeys[*]`. Each entry is a
 *      `FactoryConfigParam` carrying `{ key, type, default?, label?,
 *      description?, enumValues?, items?, properties?, tier? }` lifted
 *      directly from the source `.lolo` `config { }` block. The widget
 *      choice falls out of `deriveInputType` (reads `items.properties`
 *      and `properties` so structured types render proper editors, not
 *      JSON textareas); the prompt comes from `label` (or a humanized
 *      fallback of `key`); the default value pre-fills the widget.
 *      Knobs tagged `tier: 'internal'` are filtered out entirely.
 *
 *   2. CAPABILITY-DRIVEN — one question per unique
 *      `signature.traits[*].capabilities[*]` tag NOT already covered
 *      by `ruleOverlay.rules[].capability`. Surfaces a `set-rule`
 *      mutation template scoped to the bound entity.
 *
 * @packageDocumentation
 */

import type {
  FactoryCallSite,
  FactoryConfigParam,
  FactoryParamValue,
  FactorySignature,
  FactoryTraitSignature,
} from '../types.js';
import type { RuleOverlay } from '../overlays.js';
import type {
  DomainQuestion,
  DomainQuestionInputType,
} from './types.js';

export function generateQuestions(
  plan: ReadonlyArray<FactoryCallSite>,
  catalog: ReadonlyArray<FactorySignature>,
  ruleOverlay?: RuleOverlay,
): DomainQuestion[] {
  const out: DomainQuestion[] = [];
  const ruleCapabilities = collectRuleCapabilities(ruleOverlay);

  for (const call of plan) {
    const signature = findSignature(catalog, call.organism, call.orbital);
    if (!signature) continue;
    out.push(...configKeyQuestions(call, signature));
    out.push(...capabilityQuestions(call, signature, ruleCapabilities));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Config-key questions — derived from the source `config { }` declaration
// ---------------------------------------------------------------------------

function configKeyQuestions(
  call: FactoryCallSite,
  signature: FactorySignature,
): DomainQuestion[] {
  const out: DomainQuestion[] = [];
  for (const trait of signature.traits) {
    for (const param of trait.overridableConfigKeys) {
      if (param.tier === 'internal') continue;
      if (isAlreadyCustomized(call, trait.name, param.key)) continue;
      out.push(buildConfigKeyQuestion(call, trait, param));
    }
  }
  return out;
}

function buildConfigKeyQuestion(
  call: FactoryCallSite,
  trait: FactoryTraitSignature,
  param: FactoryConfigParam,
): DomainQuestion {
  const label = param.label ?? humanizeKey(param.key);
  const question = `${label}?`;
  const reason =
    param.description ??
    `Customizes "${param.key}" on the ${trait.name} trait. ` +
      (param.default !== undefined
        ? `Default: ${stringifyDefault(param.default)}.`
        : `No default — leave blank to inherit the factory's behavior.`);

  const out: DomainQuestion = {
    id: `${call.orbital}.${trait.name}.${param.key}`,
    orbitalName: call.orbital,
    question,
    reason,
    inputType: deriveInputType(param),
    mutationTemplate: {
      kind: 'set-trait-override-config',
      orbitalName: call.orbital,
      traitName: trait.name,
      configKey: param.key,
    },
  };
  if (param.default !== undefined) {
    out.defaultValue = param.default;
  }
  if (param.enumValues && param.enumValues.length > 0) {
    out.suggestedAnswers = param.enumValues;
  }
  if (param.items) {
    out.itemSchema = param.items;
  }
  if (param.properties) {
    out.objectSchema = param.properties;
  }
  if (param.tier) {
    out.tier = param.tier;
  }
  return out;
}

function isAlreadyCustomized(
  call: FactoryCallSite,
  traitName: string,
  configKey: string,
): boolean {
  const override = call.params.traitOverrides?.[traitName];
  if (!override?.config) return false;
  return Object.prototype.hasOwnProperty.call(override.config, configKey);
}

/**
 * Pick a widget for a config-key question from the param's typed
 * declaration + its structural carriers. The type tag is lifted
 * verbatim from `.lolo`; `items.properties` and `properties` carry the
 * per-element / per-property schema for structured types so the studio
 * can render a real form instead of a JSON textarea.
 *
 *  - `[T]` with `items.properties` → `listOfObjects` (repeatable form)
 *  - `[T]` with `enumValues`       → `multiselect` (closed checkboxes)
 *  - `[T]` otherwise               → `tagList` (free-form chips)
 *  - `object` with `properties`    → `objectForm` (per-property form)
 *  - `object` otherwise            → `text` (rare; flagged by tests)
 *  - `number` / `integer`          → `number`
 *  - `boolean`                     → `boolean`
 *  - `enum`                        → `enum`
 *  - `string` with `enumValues`    → `enum`
 *  - `string`                      → `text`
 */
export function deriveInputType(
  param: FactoryConfigParam,
): DomainQuestionInputType {
  if (param.type.startsWith('[')) {
    if (
      param.items?.properties &&
      Object.keys(param.items.properties).length > 0
    ) {
      return 'listOfObjects';
    }
    if (param.enumValues && param.enumValues.length > 0) {
      return 'multiselect';
    }
    return 'tagList';
  }
  if (param.type === 'object') {
    if (param.properties && Object.keys(param.properties).length > 0) {
      return 'objectForm';
    }
    return 'text';
  }
  switch (param.type) {
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'enum':
      return 'enum';
    case 'string':
      return param.enumValues && param.enumValues.length > 0 ? 'enum' : 'text';
    default:
      return 'text';
  }
}

/**
 * Humanize a camelCase / kebab-case key into a question prompt
 * fallback when the source `.lolo` doesn't author an explicit label.
 *
 *   `itemActions`   → `"Item Actions"`
 *   `owner-field`   → `"Owner Field"`
 *   `URL`           → `"URL"` (preserves all-caps runs)
 */
function humanizeKey(key: string): string {
  const parts = key
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(' ')
    .filter((s) => s.length > 0);
  return parts
    .map((p) => (/^[A-Z]+$/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

function stringifyDefault(v: FactoryParamValue): string {
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? '' : 's'}`;
  return 'object';
}

// ---------------------------------------------------------------------------
// Capability-driven questions
// ---------------------------------------------------------------------------

function capabilityQuestions(
  call: FactoryCallSite,
  signature: FactorySignature,
  ruleCapabilities: ReadonlySet<string>,
): DomainQuestion[] {
  const entityName =
    call.params.entityName ?? signature.entities[0]?.name ?? call.orbital;
  const seen = new Set<string>();
  const out: DomainQuestion[] = [];
  for (const trait of signature.traits) {
    for (const cap of trait.capabilities) {
      if (seen.has(cap)) continue;
      seen.add(cap);
      if (ruleCapabilities.has(cap)) continue;
      out.push({
        id: `${call.orbital}.capability.${cap}`,
        orbitalName: call.orbital,
        question: capabilityPrompt(cap, entityName),
        reason: capabilityReason(cap, trait),
        capability: cap,
        inputType: 'capability',
        mutationTemplate: {
          kind: 'set-rule',
          capability: cap,
          appliesTo: [entityName],
        },
        suggestedAnswers: ['yes', 'skip'],
      });
    }
  }
  return out;
}

function capabilityPrompt(capability: string, entity: string): string {
  return `Should "${capability}" apply to ${entity}?`;
}

function capabilityReason(
  capability: string,
  trait: FactoryTraitSignature,
): string {
  return `The "${trait.name}" trait advertises capability "${capability}". Answer "yes" to wire a matching rule into the schema.`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findSignature(
  catalog: ReadonlyArray<FactorySignature>,
  organism: string,
  orbital: string,
): FactorySignature | undefined {
  return catalog.find((s) => s.organism === organism && s.orbital === orbital);
}

function collectRuleCapabilities(
  overlay: RuleOverlay | undefined,
): ReadonlySet<string> {
  const out = new Set<string>();
  for (const r of overlay?.rules ?? []) {
    if (typeof r.capability === 'string') out.add(r.capability);
  }
  return out;
}
