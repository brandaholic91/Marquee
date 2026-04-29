import { describe, it, expect } from 'vitest';
import { modelForRole } from './index.js';

describe('modelForRole', () => {
  it('returns gpt-5.4 for director', () => {
    const m = modelForRole('director');
    expect(m.provider).toBe('openai-codex');
    expect(m.id).toBe('gpt-5.4');
  });

  it('returns gpt-5.4 for copywriter', () => {
    const m = modelForRole('copywriter');
    expect(m.id).toBe('gpt-5.4');
  });

  it('returns gpt-5.4-mini for social-manager', () => {
    const m = modelForRole('social-manager');
    expect(m.id).toBe('gpt-5.4-mini');
  });

  it('returns gpt-5.4-mini for paid-specialist', () => {
    const m = modelForRole('paid-specialist');
    expect(m.id).toBe('gpt-5.4-mini');
  });

  it('falls back to gpt-5.4-mini for unknown role', () => {
    const m = modelForRole('unknown-role');
    expect(m.id).toBe('gpt-5.4-mini');
  });
});
