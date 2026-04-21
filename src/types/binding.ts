/**
 * Binding root classification
 *
 * The prefix of an `@X.path` binding expression identifies which runtime
 * context resolves the rest of the path. This type is the TS-side mirror
 * of `OirBindingRoot` in `orbital-core`'s IR; publishing it from
 * `@almadar/core` lets the codegen, the runtime binding resolver, and
 * the verifier's schema walker all refer to the same narrow union.
 *
 * Distinct from {@link ParsedBinding.root} (which is a plain string): use
 * `BindingRoot` whenever you need exhaustiveness over the known prefixes.
 *
 * - `entity`: `@entity.field` — the trait's linked entity (first row on
 *   the client, `getById` result on the server).
 * - `payload`: `@payload.x` — the last event's payload.
 * - `state`: `@state.x` — the state machine's `state` slot (rare;
 *   mostly used for guard/effect contexts).
 * - `config`: `@config.x` — the trait ref's merged config from the
 *   molecule call site.
 * - `user`: `@user.x` — authenticated user / agent context.
 * - `trait`: `@trait.x` — render-time reference to another trait's
 *   mounted view. Resolved by `<TraitFrame>` at runtime, not by the
 *   SExpression compiler.
 * - `item`: `@item.x` — iterator variable inside a `map` / repeat
 *   pattern.
 * - `now`: `@now` — current timestamp (ISO string).
 * - `computed`: `@computed.x` — evaluator-computed value (Phase 4.5).
 * - `other`: catch-all for unknown prefixes or entity-reference
 *   bindings (`@User.name`, `@_item`).
 *
 * @packageDocumentation
 */

export type BindingRoot =
  | 'entity'
  | 'payload'
  | 'state'
  | 'config'
  | 'user'
  | 'trait'
  | 'item'
  | 'now'
  | 'computed'
  | 'other';

/** Every known binding root, in a stable order — useful for exhaustiveness checks. */
export const BINDING_ROOTS: readonly BindingRoot[] = [
  'entity',
  'payload',
  'state',
  'config',
  'user',
  'trait',
  'item',
  'now',
  'computed',
  'other',
] as const;

const KNOWN_ROOTS = new Set<string>(BINDING_ROOTS.filter((r) => r !== 'other'));

/**
 * Narrow a raw binding-root string (e.g. the `root` field of
 * `ParsedBinding` from `./expression.ts`) to a `BindingRoot`. Returns
 * `'other'` for entity-reference roots like `@User.name` or unknown
 * prefixes.
 */
export function toBindingRoot(root: string): BindingRoot {
  return KNOWN_ROOTS.has(root) ? (root as BindingRoot) : 'other';
}
