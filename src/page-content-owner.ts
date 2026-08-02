/**
 * The slot-outlet contract: **which single trait owns a page's content region.**
 *
 * Every consumer that has needed this fact so far has had to guess, and the
 * guesses are ledgered failures. `unclaimed-main-writer` is pinned at
 * `warning` with the note that "statics cannot split that class from the
 * dedicated-feature convention" (`V-WIRING-LINT-STRAY-WRITER-NEEDS-SLOT-OUTLET-CONTRACT`),
 * and a `viewer-stranded` check was written, calibrated three times
 * (832 → 672 → 135 findings, the last still flagging the finished exemplar
 * `std-helpdesk`) and withdrawn. Both failed on the same missing fact, because
 * the defect they hunt is not "this body has no exit" — a `std-filter` arm
 * re-rendering its own filter surface has no exit either and is correct. It is
 * "**the trait that OWNS this page's content replaced that content with
 * something unrelated**", which cannot be asked without an owner.
 *
 * Ownership is derived from what the page already declares, never named or
 * inferred from a trait's name:
 *   - **channel** — the page's shell designates its body through a config slot
 *     (`contentTrait` / `idleContent` / a bound body tree). That designation is
 *     an explicit authoring act, so it wins outright.
 *   - **sole-writer** — no channel, and exactly one page-declared trait paints a
 *     content-grade body into `main`.
 *   - **ambiguous** — more than one candidate. This is a RESULT, not a failure
 *     to be papered over: a caller must report it rather than pick, because
 *     picking is what produced the false positives above.
 *   - **none** — the page paints no content body at all (a pure chrome or
 *     dialog-only page).
 *
 * @packageDocumentation
 */
import { isContentBodyPattern, isMainSlotRenderUi } from './patterns/content-grade.js';
import { isPageReference } from './types/index.js';
import type { Effect, OrbitalDefinition, OrbitalPage, Trait } from './types/index.js';

/** Which trait owns a page's content region, and how that was established. */
export type PageContentOwner =
  | { readonly kind: 'channel'; readonly trait: string }
  | { readonly kind: 'sole-writer'; readonly trait: string }
  | { readonly kind: 'ambiguous'; readonly candidates: readonly string[] }
  | { readonly kind: 'none' };

/** True when this effect list paints a content-grade body into `main`,
 *  including through `if` branches. */
function writesContentMain(effects: readonly Effect[] | undefined): boolean {
  const scan = (node: unknown): boolean => {
    if (!Array.isArray(node)) return false;
    if (isMainSlotRenderUi(node)) return isContentBodyPattern(node[2]);
    return node.some(scan);
  };
  return (effects ?? []).some(scan);
}

/**
 * True when the trait paints a content-grade body into `main` anywhere in its
 * transition / tick / initial effects. The content-grade classification itself
 * stays in `./patterns/content-grade.js` — single owner, no local lists.
 */
export function isContentMainWriter(trait: Trait): boolean {
  return (
    (trait.stateMachine?.transitions ?? []).some((transition) => writesContentMain(transition.effects)) ||
    (trait.ticks ?? []).some((tick) => writesContentMain(tick.effects)) ||
    writesContentMain(trait.initialEffects)
  );
}

/**
 * Reduce a candidate set to the trait(s) that actually own the region, using
 * the two DIFFERENT relations a trait graph carries:
 *
 *   - **designation** (config slots — `contentTrait`, `idleContent`): "my body
 *     is X". A designator is never the body, so the DEEPER link wins. This is
 *     the shell → search → catalog chain.
 *   - **containment** (a `@trait.X` in render effects): "X is part of what I
 *     paint". A contained trait is never a rival, so the OUTER one wins. This
 *     is the catalog → browse → materialised `DataGrid1`/`DenseTableView`/
 *     `MasterListView` views that `orbital resolve` promotes to page level.
 *
 * Collapsing the two — testing containment with the config map, or ancestry
 * with the embed map — makes an ordinary browse page resolve `ambiguous`, and
 * a check gated on having an owner then reports nothing at all while looking
 * perfectly healthy.
 */
function reduceToOwners(
  candidates: ReadonlySet<string>,
  configAdjacency: ReadonlyMap<string, ReadonlySet<string>>,
  embedAdjacency: ReadonlyMap<string, ReadonlySet<string>>,
): string[] {
  const reach = (start: string, adjacency: ReadonlyMap<string, ReadonlySet<string>>): Set<string> => {
    const out = new Set<string>();
    const walk = [start];
    const seen = new Set<string>();
    while (walk.length > 0) {
      const from = walk.shift();
      if (from === undefined || seen.has(from)) continue;
      seen.add(from);
      for (const target of adjacency.get(from) ?? []) {
        out.add(target);
        walk.push(target);
      }
    }
    return out;
  };
  const members = [...candidates];
  const dropped = new Set<string>();
  for (const a of members) {
    const designates = reach(a, configAdjacency);
    const contains = reach(a, embedAdjacency);
    for (const b of members) {
      if (a === b) continue;
      if (designates.has(b)) dropped.add(a);        // a names b as its body
      else if (contains.has(b)) dropped.add(b);     // b is a part of a
    }
  }
  return members.filter((name) => !dropped.has(name));
}

/**
 * Resolve the content owner of one page.
 *
 * @param page          the page declaration
 * @param traits        every trait in the orbital, by name
 * @param configAdjacency  `collectTraitConfigRefAdjacency(orbital)` — the
 *                      content channel, i.e. `@trait.X` references appearing in
 *                      trait CONFIG (not state machines). Passed in rather than
 *                      recomputed so a caller walking many pages builds it once.
 */
export function resolvePageContentOwner(
  page: OrbitalPage,
  traits: ReadonlyMap<string, Trait>,
  configAdjacency: ReadonlyMap<string, ReadonlySet<string>>,
  embedAdjacency: ReadonlyMap<string, ReadonlySet<string>> = configAdjacency,
): PageContentOwner {
  const declared: string[] = [];
  for (const ref of page.traits ?? []) {
    const name = typeof ref === 'string' ? ref : ref.ref;
    if (typeof name === 'string' && name.length > 0) declared.push(name);
  }
  if (declared.length === 0) return { kind: 'none' };
  const onPage = new Set(declared);

  // 1. The content channel — a page-declared trait designating a body through
  //    its config. Transitive, because a shell may designate a wrapper that
  //    itself designates the body.
  const channel = new Set<string>();
  const seen = new Set<string>();
  const queue = declared.filter((name) => onPage.has(name));
  while (queue.length > 0) {
    const from = queue.shift();
    if (from === undefined || seen.has(from)) continue;
    seen.add(from);
    for (const target of configAdjacency.get(from) ?? []) {
      const trait = traits.get(target);
      if (trait === undefined) continue;
      if (isContentMainWriter(trait)) channel.add(target);
      queue.push(target);
    }
  }
  // The channel is a CHAIN, not a set of rivals: a shell designates a search
  // wrapper which designates the catalog, and all three may write content. The
  // owner is the DEEPEST link — a member that designates another member is its
  // ancestor, not the body. Collecting them flat made a perfectly ordinary
  // shell → search → catalog page read as `ambiguous`, which silently disabled
  // every check gated on having an owner.
  const terminal = reduceToOwners(channel, configAdjacency, embedAdjacency);
  if (terminal.length === 1) {
    const [only] = terminal;
    if (only !== undefined) return { kind: 'channel', trait: only };
  }
  if (terminal.length > 1) return { kind: 'ambiguous', candidates: terminal.sort() };

  // 2. No channel: the page's own content-grade `main` writers. A trait that
  //    some other page trait designates through config is already accounted
  //    for above, so anything left is a direct page-level writer.
  const writers = declared.filter((name) => {
    const trait = traits.get(name);
    return trait !== undefined && isContentMainWriter(trait);
  });
  const distinct = reduceToOwners(new Set(writers), configAdjacency, embedAdjacency);
  if (distinct.length === 0) return { kind: 'none' };
  if (distinct.length === 1) {
    const [only] = distinct;
    if (only !== undefined) return { kind: 'sole-writer', trait: only };
  }
  return { kind: 'ambiguous', candidates: distinct.sort() };
}

/**
 * Every page's content owner in one orbital, keyed by page path. Convenience
 * for consumers that need the whole map; the per-page resolver stays exported
 * so a caller can ask about one page without walking the orbital.
 */
export function resolveContentOwners(
  orbital: OrbitalDefinition,
  traits: ReadonlyMap<string, Trait>,
  configAdjacency: ReadonlyMap<string, ReadonlySet<string>>,
): ReadonlyMap<string, PageContentOwner> {
  const out = new Map<string, PageContentOwner>();
  for (const ref of orbital.pages ?? []) {
    // `pages` may hold cross-orbital references as well as inline declarations;
    // only an inline page carries the trait list ownership is derived from.
    if (isPageReference(ref)) continue;
    const path = ref.path;
    if (typeof path !== 'string' || path.length === 0) continue;
    out.set(path, resolvePageContentOwner(ref, traits, configAdjacency));
  }
  return out;
}
