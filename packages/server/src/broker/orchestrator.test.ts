// packages/server/src/broker/orchestrator.test.ts
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { openDb, type AgencyDb } from "../db/index.js";
import { briefs, delegations, deliverables, deliverableRevisions, workflowRuns } from "../db/schema.js";
import { Broker } from "./event-bus.js";
import { BriefOrchestrator } from "./orchestrator.js";
import type { AgentRouter } from "./router.js";

function makeRouter() {
  return {
    spawnAndPrompt: vi.fn(),
    queueBrief: vi.fn(),
    getWarmRoles: vi.fn(() => [
      "director", "content-lead", "distribution-lead", "insights-lead", "eval-judge",
    ]),
  } as unknown as AgentRouter;
}

function insertBrief(db: AgencyDb, contentMd: string) {
  const id = randomUUID();
  db.insert(briefs).values({ id, contentMd, status: "dispatched", campaignId: null }).run();
  return id;
}

function insertDelegation(db: AgencyDb, briefId: string, fromAgent: string, toAgent: string) {
  const id = randomUUID();
  db.insert(delegations).values({
    id, briefId, fromAgent, toAgent, status: "in_progress",
    payloadJson: { task: "orchestrator-managed" } as never,
    campaignId: null,
  }).run();
  return id;
}

describe("BriefOrchestrator", () => {
  let dir: string;
  let db: AgencyDb;
  let close: () => void;
  let broker: Broker;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "orchestrator-test-"));
    const handle = openDb(join(dir, "test.db"));
    db = handle.db;
    close = handle.close;
    broker = new Broker(db);
  });

  afterEach(() => {
    close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("onBriefDispatched ismert type-nál: workflow_run létrejön és spawnAndPrompt hívódik", () => {
    const router = makeRouter();
    const orchestrator = new BriefOrchestrator(db, broker, router);
    const briefId = insertBrief(db, "Írj egy blog_post-ot az AI marketingről.");

    const handled = orchestrator.onBriefDispatched(briefId);

    expect(handled).toBe(true);
    const runs = db.select().from(workflowRuns).all();
    expect(runs).toHaveLength(1);
    expect(runs[0].briefId).toBe(briefId);
    expect(runs[0].workflowId).toBe("blog_post");
    expect(runs[0].status).toBe("running");
    expect(runs[0].currentStepId).toBe("seo");
    expect(router.spawnAndPrompt).toHaveBeenCalledOnce();
  });

  it("onBriefDispatched ismeretlen type-nál: false visszatér, nincs workflow_run", () => {
    const router = makeRouter();
    const orchestrator = new BriefOrchestrator(db, broker, router);
    const briefId = insertBrief(db, "Valami amihez nincs workflow.");

    const handled = orchestrator.onBriefDispatched(briefId);

    expect(handled).toBe(false);
    expect(db.select().from(workflowRuns).all()).toHaveLength(0);
    expect(router.spawnAndPrompt).not.toHaveBeenCalled();
  });

  it("onDeliverableShipped seo lépésnél: keywords kinyerődik, write lépés indul", async () => {
    const router = makeRouter();
    const orchestrator = new BriefOrchestrator(db, broker, router);
    const briefId = insertBrief(db, "Írj egy blog_post-ot az AI marketingről.");
    orchestrator.onBriefDispatched(briefId);

    const run = db.select().from(workflowRuns).all()[0]!;
    const delegId = insertDelegation(db, briefId, "orchestrator", "insights-lead");

    const deliverableId = randomUUID();
    const revisionId = randomUUID();
    const artifactPath = join(dir, "seo_output.md");
    writeFileSync(artifactPath, "## SEO\n\n**Elsődleges kulcsszó:** AI marketing automatizálás\n");
    db.insert(deliverables).values({
      id: deliverableId, delegationId: delegId, type: "seo_report",
      title: "SEO", status: "shipped", currentRevisionId: revisionId, campaignId: null,
    }).run();
    db.insert(deliverableRevisions).values({
      id: revisionId, deliverableId, artifactPath, createdByAgent: "seo-analyst",
    }).run();
    db.update(workflowRuns).set({ activeDelegationId: delegId }).where(eq(workflowRuns.id, run.id)).run();

    const handled = orchestrator.onDeliverableShipped(deliverableId);

    expect(handled).toBe(true);
    const updatedRun = db.select().from(workflowRuns).where(eq(workflowRuns.id, run.id)).get()!;
    expect(updatedRun.currentStepId).toBe("write");
    expect((updatedRun.stateJson as { keywords?: string }).keywords).toBe("AI marketing automatizálás");
    expect(router.spawnAndPrompt).toHaveBeenCalledTimes(2);
  });

  it("onDeliverableShipped requiresApproval lépésnél: status → awaiting_approval", async () => {
    const router = makeRouter();
    const orchestrator = new BriefOrchestrator(db, broker, router);
    const briefId = insertBrief(db, "Készíts egy linkedin_post-ot.");
    orchestrator.onBriefDispatched(briefId);

    const run = db.select().from(workflowRuns).all()[0]!;
    const delegId = insertDelegation(db, briefId, "orchestrator", "distribution-lead");

    const deliverableId = randomUUID();
    const revisionId = randomUUID();
    const artifactPath = join(dir, "li_output.md");
    writeFileSync(artifactPath, "LinkedIn poszt tartalom...");
    db.insert(deliverables).values({
      id: deliverableId, delegationId: delegId, type: "linkedin_post",
      title: "LinkedIn poszt", status: "awaiting_approval", currentRevisionId: revisionId, campaignId: null,
    }).run();
    db.insert(deliverableRevisions).values({
      id: revisionId, deliverableId, artifactPath, createdByAgent: "distribution-lead",
    }).run();
    db.update(workflowRuns).set({ activeDelegationId: delegId }).where(eq(workflowRuns.id, run.id)).run();

    orchestrator.onDeliverableShipped(deliverableId);

    const updatedRun = db.select().from(workflowRuns).where(eq(workflowRuns.id, run.id)).get()!;
    expect(updatedRun.status).toBe("awaiting_approval");
    expect(updatedRun.currentStepId).toBe("write");
  });

  it("onApprovalDecision('approved') utolsó lépésnél: status → complete", async () => {
    const router = makeRouter();
    const orchestrator = new BriefOrchestrator(db, broker, router);
    const briefId = insertBrief(db, "Készíts egy linkedin_post-ot.");
    orchestrator.onBriefDispatched(briefId);

    const run = db.select().from(workflowRuns).all()[0]!;
    const delegId = insertDelegation(db, briefId, "orchestrator", "distribution-lead");

    const deliverableId = randomUUID();
    const revisionId = randomUUID();
    const artifactPath = join(dir, "li_approved.md");
    writeFileSync(artifactPath, "LinkedIn poszt tartalom...");
    db.insert(deliverables).values({
      id: deliverableId, delegationId: delegId, type: "linkedin_post",
      title: "LinkedIn poszt", status: "awaiting_approval", currentRevisionId: revisionId, campaignId: null,
    }).run();
    db.insert(deliverableRevisions).values({
      id: revisionId, deliverableId, artifactPath, createdByAgent: "distribution-lead",
    }).run();
    db.update(workflowRuns)
      .set({ activeDelegationId: delegId, status: "awaiting_approval" })
      .where(eq(workflowRuns.id, run.id)).run();

    const handled = orchestrator.onApprovalDecision(deliverableId, "approved");

    expect(handled).toBe(true);
    const updatedRun = db.select().from(workflowRuns).where(eq(workflowRuns.id, run.id)).get()!;
    expect(updatedRun.status).toBe("complete");
  });

  it("onApprovalDecision('requested_changes'): retryCount++, ugyanaz a lépés újra fut", async () => {
    const router = makeRouter();
    const orchestrator = new BriefOrchestrator(db, broker, router);
    const briefId = insertBrief(db, "Készíts egy linkedin_post-ot.");
    orchestrator.onBriefDispatched(briefId);

    const run = db.select().from(workflowRuns).all()[0]!;
    const delegId = insertDelegation(db, briefId, "orchestrator", "distribution-lead");

    const deliverableId = randomUUID();
    const revisionId = randomUUID();
    const artifactPath = join(dir, "li_retry.md");
    writeFileSync(artifactPath, "LinkedIn poszt tartalom...");
    db.insert(deliverables).values({
      id: deliverableId, delegationId: delegId, type: "linkedin_post",
      title: "LinkedIn poszt", status: "awaiting_approval", currentRevisionId: revisionId, campaignId: null,
    }).run();
    db.insert(deliverableRevisions).values({
      id: revisionId, deliverableId, artifactPath, createdByAgent: "distribution-lead",
    }).run();
    db.update(workflowRuns)
      .set({ activeDelegationId: delegId, status: "awaiting_approval", retryCount: 0 })
      .where(eq(workflowRuns.id, run.id)).run();

    const handled = orchestrator.onApprovalDecision(deliverableId, "requested_changes", "Rövidítsd meg!");

    expect(handled).toBe(true);
    const updatedRun = db.select().from(workflowRuns).where(eq(workflowRuns.id, run.id)).get()!;
    expect(updatedRun.retryCount).toBe(1);
    expect(updatedRun.status).toBe("running");
    expect(updatedRun.currentStepId).toBe("write");
    expect(router.spawnAndPrompt).toHaveBeenCalledTimes(2);
  });
});
