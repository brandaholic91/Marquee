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
    const tools = getRoleConfig('director').tools;
    expect(tools).toContain('get_campaign_status');
    expect(tools).toContain('propose_brief');
    expect(tools).toContain('propose_memory_update');
    expect(tools).toContain('read_memory');
    expect(tools).toContain('get_campaign_plan');
    expect(tools).toContain('propose_campaign_plan');
    expect(tools).toContain('update_campaign_plan');
    expect(tools).toContain('propose_calendar_item');
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
