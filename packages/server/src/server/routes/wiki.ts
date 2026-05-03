import type { FastifyPluginAsync } from 'fastify';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and, isNull } from 'drizzle-orm';
import { readWikiPage } from '../../memory/wiki.js';
import { wikiProposals } from '../../db/schema.js';

type Db = ReturnType<typeof drizzle>;

export interface WikiRoutesOpts {
  db: Db;
  dataDir: string;
}

const ALLOWED_WIKI_PAGES = ['brand-voice-patterns.md', 'seo-learnings.md', 'content-performance.md', 'SCHEMA.md'];

export const wikiRoutes: FastifyPluginAsync<WikiRoutesOpts> = async (app, opts) => {
  const { db, dataDir } = opts;

  // GET /api/wiki/:page
  app.get<{ Params: { page: string } }>('/api/wiki/:page', async (req, reply) => {
    const clientSlug = (req as any).user?.clientSlug || 'default';
    const { page } = req.params;

    if (!ALLOWED_WIKI_PAGES.includes(page)) {
      return reply.code(400).send({ error: 'invalid page' });
    }

    try {
      const content = await readWikiPage(dataDir, `clients/${clientSlug}/${page}`);
      return { page, content: content || '' };
    } catch (err) {
      console.error('Wiki read error:', err);
      return reply.code(500).send({ error: 'failed to read wiki' });
    }
  });

  // GET /api/wiki/proposals
  app.get('/api/wiki/proposals', async (req, reply) => {
    const clientSlug = (req as any).user?.clientSlug || 'default';

    try {
      const proposals = db
        .select()
        .from(wikiProposals)
        .where(
          and(
            eq(wikiProposals.clientSlug, clientSlug),
            isNull(wikiProposals.approvedAt),
            isNull(wikiProposals.rejectedAt)
          )
        )
        .orderBy(wikiProposals.createdAt)
        .all();

      return { proposals };
    } catch (err) {
      console.error('Wiki proposals list error:', err);
      return reply.code(500).send({ error: 'failed to list proposals' });
    }
  });
};
