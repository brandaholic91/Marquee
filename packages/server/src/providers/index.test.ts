import { describe, it, expect, afterEach } from 'vitest';
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

describe('OpenCode Go fallback', () => {
  const originalEnv = process.env.OPENCODE_API_KEY;

  afterEach(() => {
    process.env.OPENCODE_API_KEY = originalEnv;
  });

  it('uses deepseek-v4-flash when OPENCODE_API_KEY is set', () => {
    process.env.OPENCODE_API_KEY = 'sk_test';
    const m = modelForRole('director');
    expect(m.provider).toBe('opencode-go');
    expect(m.id).toBe('deepseek-v4-flash');
  });

  it('uses deepseek-v4-flash for all roles when OPENCODE_API_KEY is set', () => {
    process.env.OPENCODE_API_KEY = 'sk_test';
    const roles = ['director', 'copywriter', 'social-manager', 'email-marketer'];
    roles.forEach((role) => {
      const m = modelForRole(role);
      expect(m.provider).toBe('opencode-go');
      expect(m.id).toBe('deepseek-v4-flash');
    });
  });

  it('reverts to openai-codex when OPENCODE_API_KEY is unset', () => {
    delete process.env.OPENCODE_API_KEY;
    const m = modelForRole('director');
    expect(m.provider).toBe('openai-codex');
    expect(m.id).toBe('gpt-5.4');
  });
});
