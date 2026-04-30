import { describe, it, expect } from 'vitest';
import * as schema from './schema.js';

describe('schema exports', () => {
  it('has all 16 plan-v1 tables', () => {
    expect(schema.clients).toBeDefined();
    expect(schema.campaigns).toBeDefined();
    expect(schema.campaignPlans).toBeDefined();
    expect(schema.campaignCalendarItems).toBeDefined();
    expect(schema.chatThreads).toBeDefined();
    expect(schema.messages).toBeDefined();
    expect(schema.briefs).toBeDefined();
    expect(schema.delegations).toBeDefined();
    expect(schema.deliverables).toBeDefined();
    expect(schema.deliverableRevisions).toBeDefined();
    expect(schema.approvals).toBeDefined();
    expect(schema.agentSessions).toBeDefined();
    expect(schema.turns).toBeDefined();
    expect(schema.events).toBeDefined();
    expect(schema.memoryProposals).toBeDefined();
    expect(schema.memoryAudit).toBeDefined();
  });

  it('does not export removed tables', () => {
    expect((schema as any).workflowRuns).toBeUndefined();
    expect((schema as any).evals).toBeUndefined();
    expect((schema as any).tasks).toBeUndefined();
  });
});

describe('campaignPlans schema', () => {
  it('campaignPlans table exists with required columns', () => {
    expect(schema.campaignPlans).toBeDefined();
    expect(schema.campaignPlans.campaignId).toBeDefined();
    expect(schema.campaignPlans.goal).toBeDefined();
    expect(schema.campaignPlans.goalType).toBeDefined();
    expect(schema.campaignPlans.audience).toBeDefined();
    expect(schema.campaignPlans.keyMessages).toBeDefined();
    expect(schema.campaignPlans.channelMix).toBeDefined();
    expect(schema.campaignPlans.timelineStart).toBeDefined();
    expect(schema.campaignPlans.timelineEnd).toBeDefined();
    expect(schema.campaignPlans.kpi).toBeDefined();
  });
});

describe('campaignCalendarItems schema', () => {
  it('campaignCalendarItems table exists with required columns', () => {
    expect(schema.campaignCalendarItems).toBeDefined();
    expect(schema.campaignCalendarItems.planId).toBeDefined();
    expect(schema.campaignCalendarItems.channel).toBeDefined();
    expect(schema.campaignCalendarItems.targetDate).toBeDefined();
    expect(schema.campaignCalendarItems.intent).toBeDefined();
    expect(schema.campaignCalendarItems.status).toBeDefined();
  });
});

describe('briefs and chatThreads new fields', () => {
  it('briefs has calendarItemId field', () => {
    expect(schema.briefs.calendarItemId).toBeDefined();
  });

  it('chatThreads has campaignId field', () => {
    expect(schema.chatThreads.campaignId).toBeDefined();
  });
});
