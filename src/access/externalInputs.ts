/**
 * Declared external inputs — the events a client outside the program (an API
 * caller, an agent acting as the user, an MCP client) may send a trait. Authored
 * as `listens { EVENT -> external { … } }`, lowered onto the trait's own
 * `stateMachine.events[]` entry as `external: true`. The one owner of that list:
 * hosts gate their input channel with it, and clients build their tool lists
 * from it. Mirrors `orbital-core/src/runtime/external_inputs.rs`.
 *
 * @packageDocumentation
 */

import type { OrbitalSchema } from '../types/schema.js';
import type { PayloadField } from '../types/state-machine.js';
import type { JsonSchema } from '../factory/types.js';
import { mapEntityFieldType } from '../factory/params-schema.js';
import { isInlineTrait, splitEventAddress } from '../types/trait.js';

export interface ExternalInput {
  orbital: string;
  trait: string;
  event: string;
  payloadSchema: PayloadField[];
  description?: string;
  synonyms?: string;
  tier?: string;
}

export function externalInputsOf(schema: OrbitalSchema): ExternalInput[] {
  const out: ExternalInput[] = [];
  for (const orbital of schema.orbitals ?? []) {
    for (const traitRef of orbital.traits ?? []) {
      if (!isInlineTrait(traitRef)) continue;
      for (const ev of traitRef.stateMachine?.events ?? []) {
        if (ev.external !== true) continue;
        out.push({
          orbital: orbital.name,
          trait: traitRef.name,
          event: ev.key,
          payloadSchema: ev.payloadSchema ?? [],
          ...(ev.description !== undefined ? { description: ev.description } : {}),
          ...(ev.synonyms !== undefined ? { synonyms: ev.synonyms } : {}),
          ...(ev.tier !== undefined ? { tier: ev.tier } : {}),
        });
      }
    }
  }
  return out;
}

export function findExternalInput(
  schema: OrbitalSchema,
  orbital: string,
  trait: string,
  event: string,
): ExternalInput | undefined {
  return externalInputsOf(schema).find((i) => i.orbital === orbital && i.trait === trait && i.event === event);
}

/**
 * The declared input a `listens`-addressed event names, resolved from the
 * calling trait's position: `EVENT` is that trait's own, `Trait.EVENT` a trait
 * of its orbital, `Orbital.Trait.EVENT` any orbital. Mirrors the L2 rule in
 * `orbital-compiler` `config_type.rs` `EventRefIndex::check`.
 */
export function findInputByAddress(
  inputs: readonly ExternalInput[],
  address: string,
  caller: { orbital: string; trait: string },
): ExternalInput | undefined {
  const { event, source } = splitEventAddress(address);
  if (source?.kind === 'any') return undefined;
  const orbital = source?.kind === 'orbital' ? source.orbital : caller.orbital;
  const trait = source === undefined ? caller.trait : source.trait;
  return inputs.find((i) => i.orbital === orbital && i.trait === trait && i.event === event);
}

/** A declared payload as the JSON Schema of one object — what a tool-calling model fills. */
export function payloadSchemaToJsonSchema(fields: readonly PayloadField[]): JsonSchema {
  const properties: { [key: string]: JsonSchema } = {};
  const required: string[] = [];
  for (const field of fields) {
    properties[field.name] = payloadFieldToJsonSchema(field);
    if (field.required === true) required.push(field.name);
  }
  return { type: 'object', properties, ...(required.length > 0 ? { required } : {}) };
}

function payloadFieldToJsonSchema(field: PayloadField): JsonSchema {
  const isArray = field.type.startsWith('[') && field.type.endsWith(']');
  const element = isArray ? field.type.slice(1, -1) : field.type;
  const shape: JsonSchema =
    field.properties !== undefined
      ? payloadSchemaToJsonSchema(field.properties)
      : (() => {
          const t = mapEntityFieldType(element);
          return t === null ? {} : { type: t };
        })();
  return isArray ? { type: 'array', items: shape } : shape;
}
