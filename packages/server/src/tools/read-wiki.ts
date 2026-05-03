import { readWikiPage } from '../memory/wiki.js';

export interface ReadWikiContext {
  dataDir: string;
  clientSlug: string;
}

export const WIKI_PAGES = [
  'brand-voice-patterns.md',
  'seo-learnings.md',
  'content-performance.md',
  'SCHEMA.md',
] as const;

export function makeReadWikiTool(ctx: ReadWikiContext) {
  return {
    name: 'read_wiki',
    description: 'Wiki oldal olvasása (brand-voice-patterns.md, seo-learnings.md, content-performance.md, vagy SCHEMA.md).',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'string', enum: WIKI_PAGES },
      },
      required: ['page'],
    },
    execute: async (input: { page: string }) => {
      if (!WIKI_PAGES.includes(input.page as typeof WIKI_PAGES[number])) {
        throw new Error(`unknown wiki page: ${input.page}`);
      }
      const content = await readWikiPage(ctx.dataDir, `clients/${ctx.clientSlug}/${input.page}`);
      if (!content) {
        return { page: input.page, content: '' };
      }
      return { page: input.page, content: content.trim() };
    },
  };
}
