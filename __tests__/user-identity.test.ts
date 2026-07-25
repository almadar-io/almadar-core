/**
 * The `@user` identity contract: claim normalization and the dev identity token.
 *
 * Both execution paths resolve `@user.x` against `UserContext`, and four
 * consumers (mocked client, Express middleware, Hono middleware, emitted
 * backends) share the token codec — so a regression here silently disables every
 * ownership filter and role gate in the corpus rather than failing loudly.
 */

import { describe, it, expect } from 'vitest';
import {
  ANONYMOUS_USER,
  DEV_TOKEN_PREFIX,
  MOCK_PERSONAS,
  decodeDevIdentityToken,
  encodeDevIdentityToken,
  findMockPersona,
  normalizeUserContext,
  resolvePersonaSpec,
  type UserContext,
} from '../index';

describe('normalizeUserContext', () => {
  it('maps a Firebase uid onto id and preserves uid', () => {
    const user = normalizeUserContext({ uid: 'firebase-abc', email: 'a@b.c' });
    expect(user?.id).toBe('firebase-abc');
    expect(user?.uid).toBe('firebase-abc');
    expect(user?.email).toBe('a@b.c');
  });

  it('maps displayName onto name and carries extra claims through', () => {
    const user = normalizeUserContext({ uid: 'u1', displayName: 'Ada L', tenantId: 't1' });
    expect(user?.name).toBe('Ada L');
    expect(user?.displayName).toBeUndefined();
    expect(user?.tenantId).toBe('t1');
  });

  it('prefers an explicit id and name over the provider aliases', () => {
    const user = normalizeUserContext({
      id: 'u1',
      uid: 'ignored',
      name: 'Real Name',
      displayName: 'Alias',
      role: 'admin',
      permissions: ['x'],
    });
    expect(user?.id).toBe('u1');
    expect(user?.name).toBe('Real Name');
    expect(user?.role).toBe('admin');
    expect(user?.permissions).toEqual(['x']);
  });

  it('drops a null email rather than surfacing it as a value', () => {
    const user = normalizeUserContext({ uid: 'u1', email: null });
    expect(user?.id).toBe('u1');
    expect(user?.email).toBeUndefined();
  });

  it('returns undefined without a usable subject', () => {
    expect(normalizeUserContext(undefined)).toBeUndefined();
    expect(normalizeUserContext(null)).toBeUndefined();
    expect(normalizeUserContext({})).toBeUndefined();
    expect(normalizeUserContext({ uid: '' })).toBeUndefined();
  });
});

describe('dev identity token', () => {
  const persona: UserContext = {
    id: 'member-1',
    name: 'Maya Member',
    email: 'maya@example.com',
    role: 'member',
    permissions: ['read'],
  };

  it('round-trips the whole identity, not just the subject', () => {
    const decoded = decodeDevIdentityToken(encodeDevIdentityToken(persona));
    expect(decoded).toEqual(persona);
    expect(decoded?.role).toBe('member');
  });

  it('produces a header-safe token', () => {
    const token = encodeDevIdentityToken(persona);
    expect(token.startsWith(DEV_TOKEN_PREFIX)).toBe(true);
    expect(token).not.toMatch(/[\s"]/);
  });

  it('fails closed on anything that is not a well-formed dev token', () => {
    expect(decodeDevIdentityToken('some.real.jwt')).toBeUndefined();
    expect(decodeDevIdentityToken(DEV_TOKEN_PREFIX)).toBeUndefined();
    expect(decodeDevIdentityToken(`${DEV_TOKEN_PREFIX}not-json`)).toBeUndefined();
    expect(decodeDevIdentityToken(`${DEV_TOKEN_PREFIX}${encodeURIComponent('{"role":"admin"}')}`))
      .toBeUndefined();
  });

  it('round-trips every seeded persona', () => {
    for (const p of MOCK_PERSONAS) {
      expect(decodeDevIdentityToken(encodeDevIdentityToken(p))).toEqual(p);
    }
  });
});

describe('resolvePersonaSpec', () => {
  it('accepts a bare seeded id or role', () => {
    expect(resolvePersonaSpec('member-1').name).toBe('Maya Member');
    expect(resolvePersonaSpec(' admin ').id).toBe('admin-1');
  });

  it('accepts a full JSON UserContext', () => {
    const user = resolvePersonaSpec('{"id":"patient-7","role":"patient"}');
    expect(user.id).toBe('patient-7');
    expect(user.role).toBe('patient');
  });

  it('throws rather than booting as nobody', () => {
    expect(() => resolvePersonaSpec('who-dis')).toThrow(/not a seeded persona/);
    expect(() => resolvePersonaSpec('{oops')).toThrow(/not valid JSON/);
    expect(() => resolvePersonaSpec('{"role":"admin"}')).toThrow(/needs an "id"/);
    expect(() => resolvePersonaSpec('["member-1"]')).toThrow(/not a seeded persona/);
    expect(() => resolvePersonaSpec('{"id":""}')).toThrow(/needs an "id"/);
  });
});

describe('persona roster', () => {
  it('resolves by id and falls back to role', () => {
    expect(findMockPersona('member-1')?.name).toBe('Maya Member');
    expect(findMockPersona('admin')?.id).toBe('admin-1');
    expect(findMockPersona('nobody')).toBeUndefined();
  });

  it('never seeds an admin as the anonymous fallback', () => {
    expect(ANONYMOUS_USER.role).toBe('anonymous');
    expect(ANONYMOUS_USER.permissions).toEqual([]);
  });
});
