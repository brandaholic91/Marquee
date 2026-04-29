import { readMemoryFile } from '../memory/read.js';
import { MEMORY_FILES, MemoryFile } from '../memory/validate.js';

export interface ReadMemoryContext {
  dataDir: string;
  clientSlug: string;
}

export function makeReadMemoryTool(ctx: ReadMemoryContext) {
  return {
    name: 'read_memory',
    description: 'Olvass be egy memóriafájlt (profile.md, brand_voice.md vagy ongoing_campaigns.md). Visszaadja a parsed frontmattert és a body markdownt.',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', enum: MEMORY_FILES },
      },
      required: ['file'],
    },
    execute: async (input: { file: MemoryFile }) => {
      if (!MEMORY_FILES.includes(input.file)) {
        throw new Error(`unknown memory file: ${input.file}`);
      }
      const r = await readMemoryFile(ctx.dataDir, ctx.clientSlug, input.file);
      if (r === null) {
        return { frontmatter: {}, body: '' };
      }
      return { frontmatter: r.frontmatter, body: r.body.trim() };
    },
  };
}
