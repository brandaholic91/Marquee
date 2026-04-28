import { randomUUID } from "node:crypto";
import { gte } from "drizzle-orm";
import type { AgencyDb } from "../db/index.js";
import { agentSessions, delegations, deliverables, evals } from "../db/schema.js";
import type { Broker } from "../broker/event-bus.js";

export async function runWeeklyReport(
  db: AgencyDb,
  _dataDir: string,
  broker: Broker,
): Promise<void> {
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const sessions = db.select().from(agentSessions)
    .where(gte(agentSessions.startedAt, weekStart)).all();
  const weekDelegations = db.select().from(delegations)
    .where(gte(delegations.requestedAt, weekStart)).all();
  const weekDeliverables = db.select().from(deliverables)
    .where(gte(deliverables.updatedAt, weekStart)).all();
  const weekEvals = db.select().from(evals)
    .where(gte(evals.createdAt, weekStart)).all();

  const sessionsByAgent = new Map<string, number>();
  for (const s of sessions) {
    sessionsByAgent.set(s.agentSlug, (sessionsByAgent.get(s.agentSlug) ?? 0) + 1);
  }
  const sessionSummary = [...sessionsByAgent.entries()]
    .map(([slug, count]) => `${slug}: ${count}`)
    .join(", ") || "none";

  const shipped = weekDeliverables.filter((d) => d.status === "shipped").length;
  const awaitingApproval = weekDeliverables.filter((d) => d.status === "awaiting_approval").length;
  const completed = weekDelegations.filter((d) => d.status === "complete").length;
  const inProgress = weekDelegations.filter((d) => d.status === "in_progress").length;
  const blocked = weekDelegations.filter((d) => d.status === "blocked").length;

  let avgScores = "no evals this week";
  if (weekEvals.length > 0) {
    const scores = weekEvals.map(
      (e) => e.scoresJson as { brand_voice?: number; factual_accuracy?: number; usp_usage?: number },
    );
    const avg = (key: "brand_voice" | "factual_accuracy" | "usp_usage"): string => {
      const vals = scores.map((s) => s[key]).filter((v): v is number => v != null);
      return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "n/a";
    };
    avgScores = `brand_voice: ${avg("brand_voice")}, factual_accuracy: ${avg("factual_accuracy")}, usp_usage: ${avg("usp_usage")}`;
  }

  const task = [
    `Weekly performance report — week of ${weekStartStr}`,
    "",
    "## Activity this week",
    `- Sessions: ${sessions.length} (${sessionSummary})`,
    `- Delegations: ${completed} completed, ${inProgress} in progress, ${blocked} blocked`,
    `- Deliverables shipped: ${shipped} | Awaiting approval: ${awaitingApproval}`,
    `- Eval scores (avg): ${avgScores}`,
    "",
    "Delegate this to analytics-analyst to produce a full performance_report deliverable.",
    "The analyst should use query_matomo and serpapi_search for live data if available.",
  ].join("\n");

  const delegationId = randomUUID();
  db.insert(delegations).values({
    id: delegationId,
    fromAgent: "cron",
    toAgent: "insights-lead",
    status: "requested",
    payloadJson: { task } as never,
  }).run();

  broker.emit("delegation_created", { delegationId, from: "cron", to: "insights-lead" });
}
