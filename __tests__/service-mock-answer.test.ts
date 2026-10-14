import { describe, expect, it } from 'vitest';
import { mockServiceAnswer, registryActionNames, registryServiceNames } from '../src/mock/serviceAnswer';

describe('mockServiceAnswer: the registry-shaped mock answer every host shares', () => {
  it('mocks each field of the action responseShape, recursing into objects', () => {
    expect(mockServiceAnswer('llm', 'generate')).toEqual({
      ok: true,
      value: { content: 'mock_content', usage: { promptTokens: 42, completionTokens: 42, totalTokens: 42 } },
    });
  });

  it('an array-of-objects field mocks to one placeholder object', () => {
    const answer = mockServiceAnswer('llm', 'classifyMany');
    expect(answer).toEqual({ ok: true, value: { verdicts: [{ id: 'mock_id', category: 'mock_category', confidence: 42 }] } });
  });

  it('a shapedBy field follows the JSON schema the caller passed', () => {
    const schema = { type: 'object', properties: { title: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } } };
    expect(mockServiceAnswer('llm', 'extract', { schema })).toEqual({
      ok: true,
      value: { data: { title: 'mock_title', tags: ['mock_tagsItem'] }, confidence: 42 },
    });
  });

  it('edge: an action without a responseShape answers a generic success', () => {
    expect(mockServiceAnswer('stripe', 'getSubscription')).toEqual({
      ok: true,
      value: { success: true, _mock: true, _action: 'getSubscription' },
    });
  });

  it('control: an undeclared action or service has no mock answer', () => {
    expect(mockServiceAnswer('llm', 'nope')).toEqual({ ok: false, reason: 'unknown-action', message: 'No mock response for action: nope' });
    expect(mockServiceAnswer('nope', 'x')).toMatchObject({ ok: false, reason: 'unknown-service' });
  });

  it('every declared action has an answer', () => {
    for (const service of registryServiceNames()) {
      for (const action of registryActionNames(service)) expect(mockServiceAnswer(service, action).ok).toBe(true);
    }
  });
});
