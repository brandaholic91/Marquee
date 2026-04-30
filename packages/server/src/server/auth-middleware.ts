import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

// Only the inbound n8n route (POST /api/briefs without an ID segment) requires auth.
// All other routes (frontend chat, approvals, etc.) are unprotected — single-tenant, LAN-only.
const PROTECTED_ROUTES = [/^\/api\/briefs$/];

const _authMiddleware: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (req, reply) => {
    const expected = process.env.MARQUEE_API_TOKEN;
    if (!expected) return;
    if (!PROTECTED_ROUTES.some((r) => r.test(req.url))) return;
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${expected}`) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  });
};

export const authMiddleware = fp(_authMiddleware);
