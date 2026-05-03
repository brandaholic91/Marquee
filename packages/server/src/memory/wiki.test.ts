import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readWikiPage, writeWikiPage } from './wiki.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('wiki file operations', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'marquee-wiki-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('readWikiPage', () => {
    it('should read markdown content from file', async () => {
      const content = '# Test Page\n\nThis is test content.';
      await writeWikiPage(testDir, 'test.md', content);

      const result = await readWikiPage(testDir, 'test.md');
      expect(result).toBe(content);
    });

    it('should return null if file not found', async () => {
      const result = await readWikiPage(testDir, 'nonexistent.md');
      expect(result).toBeNull();
    });
  });

  describe('writeWikiPage', () => {
    it('should create file atomically', async () => {
      const content = '# New Page\n\nNew content.';
      await writeWikiPage(testDir, 'new.md', content);

      const result = await readWikiPage(testDir, 'new.md');
      expect(result).toBe(content);
    });

    it('should overwrite existing file', async () => {
      const oldContent = '# Old\n\nOld content.';
      const newContent = '# New\n\nNew content.';

      await writeWikiPage(testDir, 'existing.md', oldContent);
      const firstRead = await readWikiPage(testDir, 'existing.md');
      expect(firstRead).toBe(oldContent);

      await writeWikiPage(testDir, 'existing.md', newContent);
      const secondRead = await readWikiPage(testDir, 'existing.md');
      expect(secondRead).toBe(newContent);
    });
  });
});
