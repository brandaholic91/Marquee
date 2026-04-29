import { describe, it, expect } from 'vitest';
import { ROLE_CONFIGS, getRoleConfig, RoleSlug } from './config.js';

describe('agent role config', () => {
  it('has exactly 4 roles', () => {
    const slugs = Object.keys(ROLE_CONFIGS);
    expect(slugs.sort()).toEqual(['copywriter', 'director', 'paid-specialist', 'social-manager']);
  });

  it('director is warm', () => {
    expect(getRoleConfig('director').lifecycle).toBe('warm');
  });

  it('all specialists are transient', () => {
    for (const slug of ['copywriter', 'social-manager', 'paid-specialist'] as const) {
      expect(getRoleConfig(slug).lifecycle).toBe('transient');
    }
  });

  it('director tool list', () => {
    expect(getRoleConfig('director').tools.sort())
      .toEqual(['propose_brief', 'propose_memory_update', 'read_memory']);
  });

  it('specialist tool list', () => {
    for (const slug of ['copywriter', 'social-manager', 'paid-specialist'] as const) {
      expect(getRoleConfig(slug).tools.sort()).toEqual(['read_memory', 'submit_deliverable']);
    }
  });
});
