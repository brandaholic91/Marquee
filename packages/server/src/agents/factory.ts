import { Agent } from '@mariozechner/pi-agent-core';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createId } from '@paralleldrive/cuid2';
import { agentSessions } from '../db/schema.js';
import { getRoleConfig, type RoleSlug } from './config.js';
import { modelForRole } from '../providers/index.js';
import { makeReadMemoryTool } from '../tools/read-memory.js';
import { makeProposeBriefTool } from '../tools/propose-brief.js';
import { makeProposeMemoryUpdateTool } from '../tools/propose-memory-update.js';
import { makeSubmitDeliverableTool } from '../tools/submit-deliverable.js';
import { loadSkillRecipes } from '../skills/loader.js';
import { renderMemoryContext } from './transform-context.js';

type Db = ReturnType<typeof drizzle>;
interface Broker { emit: (e: Record<string, unknown>) => void; }

export interface SpawnInput {
  db: Db;
  broker: Broker;
  dataDir: string;
  clientSlug: string;
  role: RoleSlug;
  threadId?: string;
  delegationId?: string;
  deliverableType?: 'social_post' | 'email' | 'blog_post' | 'ad_copy';
}

export interface SpawnedAgent {
  agent: Agent;
  session: { id: string; lifecycle: 'warm' | 'transient' };
}

export async function spawnAgent(input: SpawnInput): Promise<SpawnedAgent> {
  const config = getRoleConfig(input.role);
  const sessionId = createId();
  const now = Date.now();

  await input.db.insert(agentSessions).values({
    id: sessionId,
    clientSlug: input.clientSlug,
    agentSlug: input.role,
    lifecycle: config.lifecycle,
    parentDelegationId: input.delegationId ?? null,
    startedAt: now,
    endedAt: null,
  });

  const tools = await buildToolsForRole(config.slug, input, sessionId);

  const skills = await loadSkillRecipes(input.dataDir, config.slug);
  const memoryBlock = await renderMemoryContext(input.dataDir, input.clientSlug, config.slug);
  const systemPrompt = `${memoryBlock}\n\n${skills}`;

  const agent = new Agent({
    model: modelForRole(config.slug),
    systemPrompt,
    tools,
  } as never);

  return { agent, session: { id: sessionId, lifecycle: config.lifecycle } };
}

async function buildToolsForRole(
  role: RoleSlug,
  input: SpawnInput,
  sessionId: string
): Promise<unknown[]> {
  const tools: unknown[] = [];
  const cfg = getRoleConfig(role);

  for (const toolName of cfg.tools) {
    switch (toolName) {
      case 'read_memory':
        tools.push(makeReadMemoryTool({ dataDir: input.dataDir, clientSlug: input.clientSlug }));
        break;
      case 'propose_brief':
        if (!input.threadId) throw new Error('propose_brief needs threadId');
        tools.push(makeProposeBriefTool({ db: input.db, broker: input.broker, clientSlug: input.clientSlug, threadId: input.threadId }));
        break;
      case 'propose_memory_update':
        tools.push(makeProposeMemoryUpdateTool({ db: input.db, broker: input.broker, clientSlug: input.clientSlug, agentSessionId: sessionId }));
        break;
      case 'submit_deliverable':
        if (!input.delegationId || !input.deliverableType) throw new Error('submit_deliverable needs delegationId and deliverableType');
        tools.push(makeSubmitDeliverableTool({
          db: input.db, broker: input.broker, dataDir: input.dataDir,
          clientSlug: input.clientSlug, delegationId: input.delegationId,
          agentSlug: role, deliverableType: input.deliverableType,
        }));
        break;
    }
  }
  return tools;
}
