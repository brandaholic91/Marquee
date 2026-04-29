import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const _authMiddleware: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (req, reply) => {
    if (req.method === 'GET') return;
    const expected = process.env.MARQUEE_API_TOKEN;
    if (!expected) return;
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${expected}`) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  });
};

export const authMiddleware = fp(_authMiddleware);
