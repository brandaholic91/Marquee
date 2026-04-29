import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { authMiddleware } from './auth-middleware.js';

let app: FastifyInstance;

beforeEach(async () => {
  delete process.env.MARQUEE_API_TOKEN;
  app = Fastify();
  await app.register(authMiddleware);
  app.get('/api/get', async () => ({ ok: true }));
  app.post('/api/post', async () => ({ ok: true }));
});

afterEach(() => {
  delete process.env.MARQUEE_API_TOKEN;
});

describe('auth middleware', () => {
  it('allows GET regardless of token state', async () => {
    process.env.MARQUEE_API_TOKEN = 'secret';
    const r = await app.inject({ method: 'GET', url: '/api/get' });
    expect(r.statusCode).toBe(200);
  });

  it('allows POST when MARQUEE_API_TOKEN is unset', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/post' });
    expect(r.statusCode).toBe(200);
  });

  it('allows POST when token is set and Authorization matches', async () => {
    process.env.MARQUEE_API_TOKEN = 'secret';
    const r = await app.inject({ method: 'POST', url: '/api/post', headers: { authorization: 'Bearer secret' } });
    expect(r.statusCode).toBe(200);
  });

  it('rejects POST with 401 when token is set and header missing', async () => {
    process.env.MARQUEE_API_TOKEN = 'secret';
    const r = await app.inject({ method: 'POST', url: '/api/post' });
    expect(r.statusCode).toBe(401);
  });

  it('rejects POST with 401 when token does not match', async () => {
    process.env.MARQUEE_API_TOKEN = 'secret';
    const r = await app.inject({ method: 'POST', url: '/api/post', headers: { authorization: 'Bearer wrong' } });
    expect(r.statusCode).toBe(401);
  });
});
