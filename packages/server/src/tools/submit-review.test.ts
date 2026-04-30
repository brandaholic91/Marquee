import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { makeSubmitReviewTool } from './submit-review.js';
import * as schema from '../db/schema.js';

let db: ReturnType<typeof drizzle>;
const events: any[] = [];
const broker = { emit: (e: any) => events.push(e) };

beforeEach(async () => {
  events.length = 0;
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(schema.clients).values({ slug: 'default', name: 'D', createdAt: Date.now() });
  await db.insert(schema.chatThreads).values({ id: 'thr_1', clientSlug: 'default', title: 't', archivedAt: null });
  await db.insert(schema.briefs).values({
    id: 'br_1', clientSlug: 'default', sourceThreadId: 'thr_1', contentMd: '{}',
    status: 'dispatched', createdAt: Date.now(), dispatchedAt: Date.now(),
  });
  await db.insert(schema.delegations).values({
    id: 'del_1', briefId: 'br_1', clientSlug: 'default', fromAgent: 'director',
    toAgent: 'copywriter', payloadJson: '{}', status: 'complete', requestedAt: Date.now(), completedAt: Date.now(),
  });
  await db.insert(schema.deliverables).values({
    id: 'dlv_1', delegationId: 'del_1', clientSlug: 'default', campaignId: null,
    type: 'blog_post', status: 'awaiting_approval',
    currentRevisionId: null, createdAt: Date.now(), updatedAt: Date.now(),
  });
});

describe('submit_review tool', () => {
  it('saves review to deliverable_reviews and emits review_completed event', async () => {
    const tool = makeSubmitReviewTool({ db, broker, deliverableId: 'dlv_1' });
    const r = await tool.execute({
      score: 7,
      comments: [{ quote: 'forradalmasít', issue: 'tiltott szó', severity: 'error' }],
      suggestions: [{ original: 'forradalmasít', suggested: 'alapjaiban változtatja meg', reasoning: 'brand voice: nem forradalmi retorika' }],
      summary: 'Kisebb brand voice eltérés — 1 tiltott szó.',
    });
    expect(r.review_id).toMatch(/^[a-z0-9]+$/);

    const reviews = await db.select().from(schema.deliverableReviews).all();
    expect(reviews).toHaveLength(1);
    expect(reviews[0].deliverableId).toBe('dlv_1');
    expect(reviews[0].score).toBe(7);
    expect(reviews[0].reviewerRole).toBe('brand_voice_guardian');
    const comments = JSON.parse(reviews[0].comments);
    expect(comments[0].severity).toBe('error');
    expect(events.some((e) => e.type === 'review_completed')).toBe(true);
  });
});
