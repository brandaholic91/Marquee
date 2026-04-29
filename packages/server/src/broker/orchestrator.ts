import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import type { AgencyDb } from "../db/index.js";
import {
  briefs,
  delegations,
  deliverables,
  deliverableRevisions,
  workflowRuns,
} from "../db/schema.js";
import type { Broker } from "./event-bus.js";
import type { AgentRouter } from "./router.js";
import { getWorkflow, parseDeliverableType } from "../workflows/index.js";
import type { WorkflowContext, WorkflowStep, WorkflowState } from "../workflows/types.js";

type WorkflowRunRow = typeof workflowRuns.$inferSelect;

export class BriefOrchestrator {
  constructor(
    private db: AgencyDb,
    private broker: Broker,
    private router: AgentRouter,
  ) {}

  onBriefDispatched(briefId: string): boolean {
    const brief = this.db.select().from(briefs).where(eq(briefs.id, briefId)).get();
    if (!brief) return false;

    const deliverableType = parseDeliverableType(brief.contentMd);
    if (!deliverableType) return false;

    const workflow = getWorkflow(deliverableType);
    if (!workflow) return false;

    const ctx: WorkflowContext = {
      brief: { id: brief.id, contentMd: brief.contentMd, campaignId: brief.campaignId ?? null },
      state: {},
      retryCount: 0,
    };

    const firstStep = workflow.steps.find((s) => !s.condition || s.condition(ctx));
    if (!firstStep) return false;

    const runId = randomUUID();
    this.db.insert(workflowRuns).values({
      id: runId,
      briefId,
      campaignId: brief.campaignId ?? null,
      workflowId: workflow.id,
      currentStepId: firstStep.id,
      stateJson: {} as never,
      status: "running",
      retryCount: 0,
    }).run();

    const run = this.db.select().from(workflowRuns).where(eq(workflowRuns.id, runId)).get()!;
    this.executeStep(run, firstStep);
    return true;
  }

  onDeliverableShipped(deliverableId: string): boolean {
    const run = this.findRunByActiveDelegation(deliverableId);
    if (!run || run.status !== "running") return false;

    const workflow = getWorkflow(run.workflowId);
    if (!workflow) return false;

    const step = workflow.steps.find((s) => s.id === run.currentStepId);
    if (!step) return false;

    let updatedState: WorkflowState = run.stateJson as WorkflowState;
    if (step.extractOutput) {
      const content = this.readDeliverableContent(deliverableId);
      const extracted = step.extractOutput(content);
      updatedState = { ...updatedState, ...extracted };
      this.db.update(workflowRuns)
        .set({ stateJson: updatedState as never, updatedAt: new Date() })
        .where(eq(workflowRuns.id, run.id)).run();
    }

    if (step.requiresApproval) {
      this.db.update(workflowRuns)
        .set({ status: "awaiting_approval", updatedAt: new Date() })
        .where(eq(workflowRuns.id, run.id)).run();
      return true;
    }

    const updatedRun = this.db.select().from(workflowRuns).where(eq(workflowRuns.id, run.id)).get()!;
    this.advanceRun(updatedRun);
    return true;
  }

  onApprovalDecision(deliverableId: string, decision: string, note?: string): boolean {
    const run = this.findRunByActiveDelegation(deliverableId);
    if (!run || run.status !== "awaiting_approval") return false;

    if (decision === "approved") {
      this.advanceRun(run);
      return true;
    }

    if (decision === "rejected") {
      this.db.update(workflowRuns)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(workflowRuns.id, run.id)).run();
      return true;
    }

    if (decision === "requested_changes") {
      const workflow = getWorkflow(run.workflowId);
      if (!workflow) return false;
      const step = workflow.steps.find((s) => s.id === run.currentStepId);
      if (!step) return false;

      const newRetryCount = run.retryCount + 1;
      this.db.update(workflowRuns)
        .set({ status: "running", retryCount: newRetryCount, updatedAt: new Date() })
        .where(eq(workflowRuns.id, run.id)).run();

      const updatedRun = this.db.select().from(workflowRuns).where(eq(workflowRuns.id, run.id)).get()!;
      const ctx = this.buildContext(updatedRun);
      const taskText = note ? `${step.taskFn(ctx)}\n\n**Visszajelzés:** ${note}` : step.taskFn(ctx);
      this.spawnDelegation(updatedRun, step.agent, taskText);
      return true;
    }

    return false;
  }

  private advanceRun(run: WorkflowRunRow): void {
    const workflow = getWorkflow(run.workflowId);
    if (!workflow) return;

    const ctx = this.buildContext(run);
    const currentIdx = workflow.steps.findIndex((s) => s.id === run.currentStepId);

    for (let i = currentIdx + 1; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      if (step.condition && !step.condition(ctx)) continue;
      this.db.update(workflowRuns)
        .set({ currentStepId: step.id, status: "running", updatedAt: new Date() })
        .where(eq(workflowRuns.id, run.id)).run();
      const updatedRun = this.db.select().from(workflowRuns).where(eq(workflowRuns.id, run.id)).get()!;
      this.executeStep(updatedRun, step);
      return;
    }

    this.db.update(workflowRuns)
      .set({ status: "complete", updatedAt: new Date() })
      .where(eq(workflowRuns.id, run.id)).run();
  }

  private executeStep(run: WorkflowRunRow, step: WorkflowStep): void {
    const ctx = this.buildContext(run);
    this.spawnDelegation(run, step.agent, step.taskFn(ctx));
  }

  private spawnDelegation(run: WorkflowRunRow, agentRole: string, taskText: string): void {
    const delegationId = randomUUID();
    this.db.insert(delegations).values({
      id: delegationId,
      briefId: run.briefId,
      fromAgent: "orchestrator",
      toAgent: agentRole,
      status: "in_progress",
      payloadJson: { task: taskText } as never,
      campaignId: run.campaignId ?? null,
    }).run();

    this.db.update(workflowRuns)
      .set({ activeDelegationId: delegationId, updatedAt: new Date() })
      .where(eq(workflowRuns.id, run.id)).run();

    (this.router as unknown as { spawnAndPrompt: (r: string, d: string, m: string) => void })
      .spawnAndPrompt(agentRole, delegationId, taskText);
  }

  private findRunByActiveDelegation(deliverableId: string): WorkflowRunRow | undefined {
    const deliverable = this.db.select().from(deliverables).where(eq(deliverables.id, deliverableId)).get();
    if (!deliverable?.delegationId) return undefined;
    return this.db.select().from(workflowRuns)
      .where(eq(workflowRuns.activeDelegationId, deliverable.delegationId)).get();
  }

  private buildContext(run: WorkflowRunRow): WorkflowContext {
    const brief = this.db.select().from(briefs).where(eq(briefs.id, run.briefId)).get();
    return {
      brief: brief
        ? { id: brief.id, contentMd: brief.contentMd, campaignId: brief.campaignId ?? null }
        : { id: run.briefId, contentMd: "", campaignId: null },
      state: (run.stateJson ?? {}) as WorkflowState,
      retryCount: run.retryCount,
    };
  }

  private readDeliverableContent(deliverableId: string): string {
    const deliverable = this.db.select().from(deliverables).where(eq(deliverables.id, deliverableId)).get();
    if (!deliverable?.currentRevisionId) return "";
    const rev = this.db.select().from(deliverableRevisions)
      .where(eq(deliverableRevisions.id, deliverable.currentRevisionId)).get();
    if (!rev?.artifactPath) return "";
    try { return readFileSync(rev.artifactPath, "utf8"); } catch { return ""; }
  }
}
