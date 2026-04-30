import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { makeProposeBriefTool } from './propose-brief.js';
import * as schema from '../db/schema.js';
import { createPlan, createCalendarItem, setCalendarItemStatus } from '../db/queries.js';

let db: ReturnType<typeof drizzle>;
const events: any[] = [];
const broker = { emit: (e: any) => events.push(e) };

beforeEach(async () => {
  events.length = 0;
  const sqlite = new Database(':memory:');
  db = drizzle(sqlite, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  await db.insert(schema.clients).values({ slug: 'default', name: 'D', createdAt: Date.now() });
  await db.insert(schema.campaigns).values({ id: 'c1', clientSlug: 'default', title: 'Campaign', status: 'active', createdAt: Date.now() });
  await db.insert(schema.chatThreads).values({ id: 'thr_1', clientSlug: 'default', title: 'main', archivedAt: null });
});

describe('propose_brief tool', () => {
  it('inserts brief draft + emits brief_proposed', async () => {
    const tool = makeProposeBriefTool({ db, broker, clientSlug: 'default', threadId: 'thr_1' });
    const r = await tool.execute({
      title: 'IG poszt — reggeli rituálé',
      content_md: 'Téma: reggeli rituálé...',
      deliverable_type: 'social_post',
      target_specialist: 'social-manager',
      platform: 'instagram',
    });
    expect(r.brief_id).toMatch(/^[a-z0-9]+$/);
    const briefs = await db.select().from(schema.briefs).all();
    expect(briefs).toHaveLength(1);
    expect(briefs[0].status).toBe('draft');
    expect(briefs[0].sourceThreadId).toBe('thr_1');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('brief_proposed');
    expect(events[0].brief_id).toBe(r.brief_id);
  });

  it('rejects mismatched deliverable_type / target_specialist', async () => {
    const tool = makeProposeBriefTool({ db, broker, clientSlug: 'default', threadId: 'thr_1' });
    await expect(tool.execute({
      title: 't',
      content_md: 'c',
      deliverable_type: 'social_post',
      target_specialist: 'paid-specialist',
    } as never)).rejects.toThrow(/cannot produce social_post/);
  });

  it('accepts calendar_item_id pointing to a planned item', async () => {
    const planId = createPlan(db, {
      campaignId: 'c1', clientSlug: 'default', goal: 'g', goalType: 'lead-gen', audience: 'a', keyMessages: [], channelMix: [],
    });
    const itemId = createCalendarItem(db, {
      planId, campaignId: 'c1', clientSlug: 'default', channel: 'linkedin', targetDate: 1715000000, intent: 'Intent',
    });
    const tool = makeProposeBriefTool({ db, broker, clientSlug: 'default', threadId: 'thr_1' });
    const r = await tool.execute({
      title: 'IG poszt',
      content_md: 'Téma',
      deliverable_type: 'social_post',
      target_specialist: 'social-manager',
      calendar_item_id: itemId,
    });
    const row = (await db.select().from(schema.briefs).where(eq(schema.briefs.id, r.brief_id)).all())[0];
    expect(row.calendarItemId).toBe(itemId);
  });

  it('rejects calendar_item_id if item is not planned', async () => {
    const planId = createPlan(db, {
      campaignId: 'c1', clientSlug: 'default', goal: 'g', goalType: 'lead-gen', audience: 'a', keyMessages: [], channelMix: [],
    });
    const itemId = createCalendarItem(db, {
      planId, campaignId: 'c1', clientSlug: 'default', channel: 'linkedin', targetDate: 1715000000, intent: 'Intent',
    });
    setCalendarItemStatus(db, itemId, 'brief_created');
    const tool = makeProposeBriefTool({ db, broker, clientSlug: 'default', threadId: 'thr_1' });
    await expect(tool.execute({
      title: 'IG poszt',
      content_md: 'Téma',
      deliverable_type: 'social_post',
      target_specialist: 'social-manager',
      calendar_item_id: itemId,
    } as never)).rejects.toThrow(/must be planned/);
  });

  it('rejects calendar_item_id from a different campaign', async () => {
    await db.insert(schema.campaigns).values({ id: 'c2', clientSlug: 'default', title: 'Campaign 2', status: 'active', createdAt: Date.now() });
    const planId = createPlan(db, {
      campaignId: 'c2', clientSlug: 'default', goal: 'g', goalType: 'lead-gen', audience: 'a', keyMessages: [], channelMix: [],
    });
    const itemId = createCalendarItem(db, {
      planId, campaignId: 'c2', clientSlug: 'default', channel: 'linkedin', targetDate: 1715000000, intent: 'Intent',
    });
    const tool = makeProposeBriefTool({ db, broker, clientSlug: 'default', threadId: 'thr_1' });
    await expect(tool.execute({
      title: 'IG poszt',
      content_md: 'Téma',
      deliverable_type: 'social_post',
      target_specialist: 'social-manager',
      calendar_item_id: itemId,
      campaign_name: 'Campaign',
    } as never)).rejects.toThrow(/campaign mismatch/);
  });
});
