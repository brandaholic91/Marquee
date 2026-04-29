import { describe, it, expect } from 'vitest';
import * as schema from './schema.js';

describe('schema exports', () => {
  it('has all 14 MVP tables', () => {
    expect(schema.clients).toBeDefined();
    expect(schema.campaigns).toBeDefined();
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
