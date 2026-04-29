import { describe, it, expect } from 'vitest';
import { validateFrontmatter, type MemoryFile } from './validate.js';

describe('validateFrontmatter', () => {
  it('accepts valid profile.md', () => {
    const fm = {
      business_description: 'foo',
      target_audience: ['urban women'],
      usp: 'unique',
      competitors: ['x', 'y'],
    };
    expect(() => validateFrontmatter('profile.md', fm)).not.toThrow();
  });

  it('rejects profile.md missing business_description', () => {
    const fm = { target_audience: [], usp: 'x', competitors: [] };
    expect(() => validateFrontmatter('profile.md', fm)).toThrow(/business_description/);
  });

  it('accepts valid brand_voice.md', () => {
    const fm = {
      tone: 'casual',
      adjectives: ['warm', 'precise'],
      reference_brands: ['Notion'],
      do: ['be specific'],
      dont: ['use jargon'],
    };
    expect(() => validateFrontmatter('brand_voice.md', fm)).not.toThrow();
  });

  it('rejects unknown file', () => {
    expect(() => validateFrontmatter('unknown.md', {})).toThrow(/unknown memory file/);
  });
});
