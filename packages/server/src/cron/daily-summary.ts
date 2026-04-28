import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { simpleGit } from "simple-git";
import type { AgencyDb } from "../db/index.js";
import { agentSessions, delegations, deliverables, evals, turns } from "../db/schema.js";

interface SessionStat { agentSlug: string; count: number; turns: number }
interface SummaryInput {
  today: string;
  sessions: SessionStat[];
  delegations: Array<{ fromAgent: string; toAgent: string; status: string; task: string }>;
  deliverables: Array<{ title: string; status: string; evalScore?: number }>;
  evals: Array<{ brand_voice?: number; factual_accuracy?: number; usp_usage?: number }>;
}

export function buildDailySummaryMd(input: SummaryInput): string {
  const lines: string[] = [`# Daily Summary — ${input.today}`, ""];

  lines.push(`## Sessions (${input.sessions.length})`);
  if (input.sessions.length === 0) {
    lines.push("- none");
  } else {
    for (const s of input.sessions) {
      lines.push(`- ${s.agentSlug}: ${s.count} session(s), ${s.turns} turns`);
    }
  }
  lines.push("");

  lines.push(`## Delegations (${input.delegations.length})`);
  if (input.delegations.length === 0) {
    lines.push("- none");
  } else {
    for (const d of input.delegations) {
      lines.push(`- ${d.fromAgent} → ${d.toAgent}: ${d.task.slice(0, 60)} (${d.status})`);
    }
  }
  lines.push("");

  lines.push(`## Deliverables (${input.deliverables.length})`);
  if (input.deliverables.length === 0) {
    lines.push("- none");
  } else {
    for (const d of input.deliverables) {
      const score = d.evalScore != null ? ` (eval: ${d.evalScore}/10)` : "";
      lines.push(`- "${d.title}" — ${d.status}${score}`);
    }
  }
  lines.push("");

  if (input.evals.length > 0) {
    lines.push("## Eval scores (latest)");
    const last = input.evals[input.evals.length - 1];
    lines.push(`- brand_voice: ${last.brand_voice ?? "n/a"}, factual_accuracy: ${last.factual_accuracy ?? "n/a"}, usp_usage: ${last.usp_usage ?? "n/a"}`);
    lines.push("");
  }

  return lines.join("\n");
}

export async function runDailySummary(db: AgencyDb, dataDir: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  const rawSessions = db.select().from(agentSessions).all()
    .filter((s) => s.startedAt && s.startedAt.toISOString().slice(0, 10) === today);

  const sessionMap = new Map<string, { count: number; turns: number }>();
  for (const s of rawSessions) {
    const entry = sessionMap.get(s.agentSlug) ?? { count: 0, turns: 0 };
    entry.count += 1;
    const sessionTurns = db.select().from(turns).all()
      .filter((t) => t.sessionId === s.id);
    entry.turns += sessionTurns.length;
    sessionMap.set(s.agentSlug, entry);
  }
  const sessions: SessionStat[] = [...sessionMap.entries()]
    .map(([agentSlug, v]) => ({ agentSlug, ...v }));

  const rawDelegations = db.select().from(delegations).all()
    .filter((d) => d.requestedAt && d.requestedAt.toISOString().slice(0, 10) === today);
  const delegationStats = rawDelegations.map((d) => ({
    fromAgent: d.fromAgent, toAgent: d.toAgent, status: d.status,
    task: ((d.payloadJson as { task?: string }).task ?? "").slice(0, 60),
  }));

  const rawDeliverables = db.select().from(deliverables).all()
    .filter((d) => d.updatedAt && d.updatedAt.toISOString().slice(0, 10) === today);
  const deliverableStats = rawDeliverables.map((d) => ({ title: d.title, status: d.status }));

  const rawEvals = db.select().from(evals).all()
    .filter((e) => e.createdAt && e.createdAt.toISOString().slice(0, 10) === today);
  const evalStats = rawEvals.map((e) => e.scoresJson as { brand_voice?: number; factual_accuracy?: number; usp_usage?: number });

  const md = buildDailySummaryMd({
    today, sessions, delegations: delegationStats, deliverables: deliverableStats, evals: evalStats,
  });

  const notesDir = join(dataDir, "memory", "daily_notes");
  mkdirSync(notesDir, { recursive: true });
  const filePath = join(notesDir, `${today}.md`);
  writeFileSync(filePath, md, "utf8");

  try {
    const git = simpleGit(dataDir);
    if (await git.checkIsRepo()) {
      await git.add(filePath);
      await git.commit(`memory: daily summary ${today}`, [filePath]);
    }
  } catch { /* best effort */ }
}
