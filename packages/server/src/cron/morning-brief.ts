import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { inArray } from "drizzle-orm";
import type { AgencyDb } from "../db/index.js";
import { chatThreads, messages, deliverables, delegations } from "../db/schema.js";
import type { Broker } from "../broker/event-bus.js";

export async function runMorningBrief(
  db: AgencyDb,
  dataDir: string,
  broker: Broker,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const notesPath = join(dataDir, "memory", "daily_notes", `${yesterdayStr}.md`);
  const notesContent = existsSync(notesPath)
    ? readFileSync(notesPath, "utf8").trim()
    : "No activity recorded.";

  const pending = db.select().from(deliverables)
    .where(inArray(deliverables.status, ["awaiting_approval", "awaiting_eval"])).all();
  const awaitingApproval = pending.filter((d) => d.status === "awaiting_approval").length;
  const awaitingEval = pending.filter((d) => d.status === "awaiting_eval").length;

  const active = db.select().from(delegations)
    .where(inArray(delegations.status, ["requested", "in_progress"])).all();

  const text = [
    "Good morning. Here is today's context:",
    "",
    "## Yesterday's activity",
    notesContent,
    "",
    "## Pending work",
    `- ${awaitingApproval} deliverable(s) awaiting approval`,
    `- ${awaitingEval} deliverable(s) awaiting eval`,
    `- ${active.length} delegation(s) in progress`,
    "",
    "Based on this, what should the agency focus on today?",
    "Summarize in 3-5 bullet points and suggest one concrete next action.",
  ].join("\n");

  const threadId = randomUUID();
  db.insert(chatThreads).values({
    id: threadId,
    type: "consultative",
    title: `Morning Brief — ${today}`,
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
