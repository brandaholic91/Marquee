import type { FastifyPluginAsync } from 'fastify';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and, isNull } from 'drizzle-orm';
import { readWikiPage, writeWikiPageWithGit } from '../../memory/wiki.js';
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

  // POST /api/wiki/proposals/:id/approve
  app.post<{ Params: { id: string } }>('/api/wiki/proposals/:id/approve', async (req, reply) => {
    const clientSlug = (req as any).user?.clientSlug || 'default';
    const { id } = req.params;
    const now = Date.now();

    try {
      const proposals = db
        .select()
        .from(wikiProposals)
        .where(and(eq(wikiProposals.id, id), eq(wikiProposals.clientSlug, clientSlug)))
        .all();

      if (proposals.length === 0) {
        return reply.code(404).send({ error: 'proposal not found' });
      }

      const proposal = proposals[0];
      if (proposal.approvedAt !== null || proposal.rejectedAt !== null) {
        return reply.code(400).send({ error: 'proposal already decided' });
      }

      // Update database
      await db
        .update(wikiProposals)
        .set({ approvedAt: now, approvedBy: clientSlug })
        .where(eq(wikiProposals.id, id));

      // Write file with git commit
      await writeWikiPageWithGit(
        dataDir,
        proposal.wikiPage,
        proposal.newContent,
        `wiki: ${proposal.wikiPage} — ${proposal.reason}`
      );

      return { success: true, proposal_id: id };
    } catch (err) {
      console.error('Wiki approval error:', err);
      return reply.code(500).send({ error: 'failed to approve' });
    }
  });

  // POST /api/wiki/proposals/:id/reject
  app.post<{ Params: { id: string }; Body: { reason?: string } }>('/api/wiki/proposals/:id/reject', async (req, reply) => {
    const clientSlug = (req as any).user?.clientSlug || 'default';
    const { id } = req.params;
    const { reason } = req.body || {};
    const now = Date.now();

    try {
      const proposals = db
        .select()
        .from(wikiProposals)
        .where(and(eq(wikiProposals.id, id), eq(wikiProposals.clientSlug, clientSlug)))
        .all();

      if (proposals.length === 0) {
        return reply.code(404).send({ error: 'proposal not found' });
      }

      const proposal = proposals[0];
      if (proposal.approvedAt !== null || proposal.rejectedAt !== null) {
        return reply.code(400).send({ error: 'proposal already decided' });
      }

      // Update database with rejection
      await db
        .update(wikiProposals)
        .set({ rejectedAt: now, rejectionReason: reason || null })
        .where(eq(wikiProposals.id, id));

      return { success: true, proposal_id: id };
    } catch (err) {
      console.error('Wiki rejection error:', err);
      return reply.code(500).send({ error: 'failed to reject' });
    }
  });
};
