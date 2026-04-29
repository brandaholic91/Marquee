import matter from 'gray-matter';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createProposal } from '../memory/proposals.js';
import { validateFrontmatter, MEMORY_FILES, type MemoryFile } from '../memory/validate.js';

type Db = ReturnType<typeof drizzle>;
interface Broker { emit: (e: Record<string, unknown>) => void; }

export interface ProposeMemoryContext {
  db: Db;
  broker: Broker;
  clientSlug: string;
  agentSessionId: string | null;
}

export function makeProposeMemoryUpdateTool(ctx: ProposeMemoryContext) {
  return {
    name: 'propose_memory_update',
    description: 'Javasolj egy memóriafájl-frissítést. A teljes új tartalmat add meg (NEM patch). Az operátor a queue-ból approve-olja vagy elveti.',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', enum: MEMORY_FILES },
        new_content: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['file', 'new_content', 'reason'],
    },
    execute: async (input: { file: MemoryFile; new_content: string; reason: string }) => {
      const parsed = matter(input.new_content);
      validateFrontmatter(input.file, parsed.data as Record<string, unknown>);

      const id = await createProposal(ctx.db, {
        clientSlug: ctx.clientSlug,
        file: input.file,
        newContent: input.new_content,
        reason: input.reason,
        agentSessionId: ctx.agentSessionId,
      });
      ctx.broker.emit({
        type: 'memory_proposed',
        proposal_id: id,
        client_slug: ctx.clientSlug,
        file: input.file,
        reason: input.reason,
      });
      return { proposal_id: id };
    },
  };
}
