import { randomUUID } from "node:crypto";
import { and, gte, lt } from "drizzle-orm";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { AgencyDb } from "../db/index.js";
import { agentSessions, chatThreads, deliverables, evals, messages, turns } from "../db/schema.js";
import type { Broker } from "../broker/event-bus.js";

export async function runMonthlyReview(
  db: AgencyDb,
  dataDir: string,
  broker: Broker,
): Promise<void> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthLabel = monthStart.toISOString().slice(0, 7); // "YYYY-MM"

  const monthSessions = db.select().from(agentSessions)
    .where(and(gte(agentSessions.startedAt, monthStart), lt(agentSessions.startedAt, monthEnd))).all();
  const monthDeliverables = db.select().from(deliverables)
    .where(and(gte(deliverables.updatedAt, monthStart), lt(deliverables.updatedAt, monthEnd))).all();
  const monthEvals = db.select().from(evals)
    .where(and(gte(evals.createdAt, monthStart), lt(evals.createdAt, monthEnd))).all();
  const monthTurns = db.select().from(turns)
    .where(and(gte(turns.startedAt, monthStart), lt(turns.startedAt, monthEnd))).all();

  const shipped = monthDeliverables.filter((d) => d.status === "shipped").length;
  const totalCostCents = monthTurns.reduce((sum, t) => sum + t.costUsd, 0);

  let avgEval = "n/a";
  if (monthEvals.length > 0) {
    const allScores = monthEvals.flatMap((e) => {
      const s = e.scoresJson as { brand_voice?: number; factual_accuracy?: number; usp_usage?: number };
      return [s.brand_voice, s.factual_accuracy, s.usp_usage].filter((v): v is number => v != null);
    });
    if (allScores.length > 0) {
      avgEval = (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1);
    }
  }

  const notesDir = join(dataDir, "memory", "daily_notes");
  const noteFiles = existsSync(notesDir)
    ? readdirSync(notesDir)
        .filter((f) => f.startsWith(monthLabel) && f.endsWith(".md"))
        .sort()
        .map((f) => `daily_notes/${f.replace(/\.md$/, "")}`)
    : [];

  const lines = [
    `Monthly strategy review — ${monthLabel} (previous month)`,
    "",
    "## Activity this month",
    `- Total sessions: ${monthSessions.length} | Total turns: ${monthTurns.length} | Estimated cost: ${totalCostCents}c`,
    `- Deliverables shipped: ${shipped} | Avg eval score: ${avgEval}/5`,
    "",
  ];

  if (noteFiles.length > 0) {
    lines.push(
      "## Daily notes available",
      noteFiles.join(", "),
      "(Use read_memory to read specific days if needed.)",
      "",
    );
  }

  lines.push(
    "## Your task",
    "Review this month's performance. Then propose updates using propose_memory_update:",
    "1. ongoing_campaigns.md — what worked, what to continue, what to drop",
    "2. client_profile.md — update ICP or positioning if it has evolved",
  );

  const text = lines.join("\n");

  const threadId = randomUUID();
  db.insert(chatThreads).values({
    id: threadId,
    type: "consultative",
    title: `Monthly Strategy Review — ${monthLabel}`,
  }).run();

  db.insert(messages).values({
    id: randomUUID(),
    threadId,
    sender: "human",
    type: "chat",
    contentJson: { text } as never,
  }).run();

  broker.emit("human_message", { threadId, text });
}
