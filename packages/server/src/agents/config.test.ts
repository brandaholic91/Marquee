import { describe, it, expect } from 'vitest';
import { ROLE_CONFIGS, getRoleConfig, type RoleSlug } from './config.js';

describe('agent role config', () => {
  it('has exactly 7 roles', () => {
    const slugs = Object.keys(ROLE_CONFIGS);
    expect(slugs.sort()).toEqual([
      'brand-voice-guardian', 'copywriter', 'director',
      'email-marketer', 'paid-specialist', 'seo-specialist', 'social-manager'
    ]);
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
      .toEqual(['get_campaign_status', 'propose_brief', 'propose_memory_update', 'read_memory']);
  });

  it('specialist tool list', () => {
    for (const slug of ['copywriter', 'social-manager', 'paid-specialist'] as const) {
      expect(getRoleConfig(slug).tools.sort()).toEqual(['read_memory', 'submit_deliverable']);
    }
  });

  it('email-marketer is transient and produces email', () => {
    const c = getRoleConfig('email-marketer');
    expect(c.lifecycle).toBe('transient');
    expect(c.produces).toContain('email');
    expect(c.tools).toContain('submit_deliverable');
  });

  it('seo-specialist is transient and produces blog_post', () => {
    const c = getRoleConfig('seo-specialist');
    expect(c.lifecycle).toBe('transient');
    expect(c.produces).toContain('blog_post');
  });

  it('brand-voice-guardian is transient and has submit_review tool', () => {
    const c = getRoleConfig('brand-voice-guardian');
    expect(c.lifecycle).toBe('transient');
    expect(c.tools).toContain('submit_review');
    expect(c.tools).toContain('read_memory');
    expect(c.produces).toHaveLength(0);
  });
});
