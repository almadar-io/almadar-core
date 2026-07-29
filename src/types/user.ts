/**
 * Authenticated user context — what `@user.x` resolves against.
 *
 * The canonical shape for the `user` binding root, shared by both execution
 * paths: the JS interpreter resolves `@user.id` through
 * `EvaluationContext.user`, and the compiled shell emits `user?.id` against the
 * `UserContext` its `@app/shared` re-exports from here.
 *
 * `id` is the field the behavior library reads for ownership scoping and `role`
 * the field it reads for capability gating. Auth providers that name the subject
 * `uid` must normalize at their boundary — {@link normalizeUserContext} does that.
 *
 * @packageDocumentation
 */

import type { FieldValue } from './entity.js';

/** Authenticated user / agent identity behind `@user.x` bindings. */
export interface UserContext {
  /** Stable subject identifier. `@user.id` — the ownership key. */
  id: string;
  /** `@user.email` */
  email?: string;
  /** `@user.name` — display name. */
  name?: string;
  /** `@user.role` — single role string, compared against a policy's allowed list. */
  role?: string;
  /** `@user.permissions` — fine-grained capability strings. */
  permissions?: string[];
  /** Additional provider claims, readable as `@user.<claim>`. */
  [key: string]: FieldValue | undefined;
}

/**
 * The identity of an unauthenticated viewer. A resolvable object rather than
 * `undefined` so a role predicate evaluates to a definite `false` instead of
 * comparing against nothing.
 */
export const ANONYMOUS_USER: UserContext = {
  id: 'anonymous',
  role: 'anonymous',
  permissions: [],
};

/** Provider-shaped identity claims, before normalization. */
export interface RawUserClaims {
  id?: string;
  uid?: string;
  email?: string | null;
  name?: string;
  displayName?: string | null;
  role?: string;
  permissions?: string[];
  [key: string]: FieldValue | undefined;
}

/** Claim keys {@link normalizeUserContext} derives rather than copies verbatim. */
const DERIVED_CLAIM_KEYS: readonly string[] = ['id', 'name', 'displayName', 'email'];

/**
 * Normalize provider claims into a {@link UserContext}.
 *
 * Firebase (and most OIDC providers) name the subject `uid` and the display name
 * `displayName`, while every `.lolo` behavior reads `@user.id` / `@user.name`.
 * Without this normalization `@user.id` is `undefined` against a fully
 * authenticated request and every ownership filter silently matches no rows.
 * `uid` is preserved so `@user.uid` keeps working.
 *
 * Returns `undefined` for absent or subject-less claims so callers can
 * distinguish "no auth ran" from "anonymous"; use {@link ANONYMOUS_USER} where a
 * definite identity is required.
 */
export function normalizeUserContext(
  claims: RawUserClaims | null | undefined,
): UserContext | undefined {
  if (!claims) return undefined;
  const id = claims.id ?? claims.uid;
  if (typeof id !== 'string' || id.length === 0) return undefined;

  const user: UserContext = { id };
  for (const [key, value] of Object.entries(claims)) {
    if (value === undefined || DERIVED_CLAIM_KEYS.includes(key)) continue;
    user[key] = value;
  }

  const name = claims.name ?? claims.displayName;
  if (typeof name === 'string' && name.length > 0) user.name = name;
  if (typeof claims.email === 'string' && claims.email.length > 0) user.email = claims.email;

  return user;
}

/**
 * Dev persona roster — seeded identities for local runs, previews and mocked
 * sign-in. NOT production data: nothing authenticates against this. It exists so
 * an app can be viewed as each persona its domain implies before real auth is
 * wired.
 *
 * A domain whose end-user role is named differently (`patient`, `student`) adds
 * its own persona at the call site; these are defaults, not an allow-list.
 */
export const MOCK_PERSONAS: readonly UserContext[] = [
  { id: 'admin-1', name: 'Ada Admin', email: 'ada@example.com', role: 'admin', permissions: ['read', 'write', 'delete'] },
  { id: 'staff-1', name: 'Sam Staff', email: 'sam@example.com', role: 'staff', permissions: ['read', 'write'] },
  { id: 'member-1', name: 'Maya Member', email: 'maya@example.com', role: 'member', permissions: ['read'] },
  { id: 'customer-1', name: 'Cai Customer', email: 'cai@example.com', role: 'customer', permissions: ['read'] },
] as const;

/**
 * The viewer a host presents when nothing named one.
 *
 * Without this, `@user` is `Null` in headless verify and preview, so every
 * `viewerName: @user.name` binding renders blank and the account menu never
 * appears — an app that cannot say who you are. Worse, an ownership filter that
 * works and one that is broken both render an empty table.
 *
 * `role` is deliberately EMPTY, not a guess. A default of `admin` would silently
 * flip which branch renders at the 38 `@user.role` comparisons in the corpus;
 * an empty role matches no literal, exactly as `Null` did, so this fixes
 * "undefined at runtime" without changing a single guard outcome.
 */
export const DEFAULT_VIEWER: UserContext = {
  id: 'viewer-1',
  name: 'Dev Viewer',
  email: 'viewer@example.com',
  role: '',
};

/** Look a dev persona up by id, or by role when no id matches. */
export function findMockPersona(idOrRole: string): UserContext | undefined {
  return (
    MOCK_PERSONAS.find((p) => p.id === idOrRole) ??
    MOCK_PERSONAS.find((p) => p.role === idOrRole)
  );
}

/**
 * Resolve a persona spec — a bare seeded id/role (`member-1`, `member`) or a full
 * JSON `UserContext` — into a viewer. This is the `ALMADAR_PERSONA` contract,
 * shared by every host that presents an app as somebody.
 *
 * Throws on anything unresolvable rather than returning `undefined`: "no persona"
 * and "persona silently ignored" look identical on screen, so a bad spec must
 * fail at boot instead of rendering as nobody.
 */
export function resolvePersonaSpec(spec: string): UserContext {
  const raw = spec.trim();
  if (!raw.startsWith('{')) {
    const seeded = findMockPersona(raw);
    if (!seeded) {
      throw new Error(
        `Persona "${raw}" is not a seeded persona id or role. Known: ${MOCK_PERSONAS.map((p) => `${p.id}/${p.role}`).join(', ')}`,
      );
    }
    return seeded;
  }
  let claims: RawUserClaims;
  try {
    claims = JSON.parse(raw);
  } catch {
    throw new Error(`Persona is not valid JSON: ${raw}`);
  }
  const user = normalizeUserContext(claims);
  if (!user) {
    throw new Error(`Persona needs an "id" (or "uid"): ${raw}`);
  }
  return user;
}

// ============================================================================
// Dev identity token
// ============================================================================

/**
 * Marks a bearer token as a mocked dev identity rather than a real ID token.
 * The prefix is deliberately unmistakable: a server accepts these ONLY behind an
 * explicit dev opt-in, so a production deployment rejects them like any other
 * malformed token.
 */
export const DEV_TOKEN_PREFIX = 'almadar-dev.';

/**
 * Encode a viewer as a dev bearer token.
 *
 * Carries the WHOLE identity, not just the subject: real Firebase claims have no
 * `role`, so a server that only reads `uid` leaves every `@user.role` gate inert
 * even for a signed-in user. URI-encoded JSON keeps the token header-safe (no
 * spaces or delimiters) and works unchanged in Node and the browser.
 */
export function encodeDevIdentityToken(user: UserContext): string {
  return DEV_TOKEN_PREFIX + encodeURIComponent(JSON.stringify(user));
}

/**
 * Decode a dev bearer token back into a viewer, or `undefined` if it is not one
 * / is malformed — callers fail closed rather than inventing an identity.
 */
export function decodeDevIdentityToken(token: string): UserContext | undefined {
  if (!token.startsWith(DEV_TOKEN_PREFIX)) return undefined;
  try {
    const claims: RawUserClaims = JSON.parse(
      decodeURIComponent(token.slice(DEV_TOKEN_PREFIX.length)),
    );
    return normalizeUserContext(claims);
  } catch {
    return undefined;
  }
}
