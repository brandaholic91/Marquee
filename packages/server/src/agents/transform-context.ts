import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readMemoryFile } from "../memory/read.js";
import type { AgencyMessage, StandardMessage } from "./messages.js";
import { convertToLlm } from "./convert-to-llm.js";

export interface TransformContextOptions {
  dataDir: string;
  role: string;
  keepRecent?: number;
}

const RELEVANT_MEMORY_FOR_ROLE: Record<string, string[]> = {
  director: ["client_profile", "brand_guidelines", "ongoing_campaigns",
             "daily_notes/YESTERDAY", "daily_notes/2_DAYS_AGO", "daily_notes/3_DAYS_AGO"],
  "content-lead": ["client_profile", "brand_guidelines", "content_history"],
  copywriter: ["client_profile", "brand_guidelines", "content_history"],
  "eval-judge": ["client_profile", "brand_guidelines"],
};

function resolveName(name: string, today: Date): string {
  if (name.startsWith("daily_notes/")) {
    const label = name.slice("daily_notes/".length);
    const d = new Date(today);
    if (label === "YESTERDAY") d.setDate(d.getDate() - 1);
    else if (label === "2_DAYS_AGO") d.setDate(d.getDate() - 2);
    else if (label === "3_DAYS_AGO") d.setDate(d.getDate() - 3);
    return `daily_notes/${d.toISOString().slice(0, 10)}`;
  }
  return name;
}

const memoryBlock = (dataDir: string, role: string): StandardMessage => {
  const memDir = join(dataDir, "memory");
  if (!existsSync(memDir)) return { role: "user", content: "<memory/>" };
  const want = RELEVANT_MEMORY_FOR_ROLE[role] ?? ["client_profile", "brand_guidelines"];
  const today = new Date();
  const blocks = want
    .map((n) => resolveName(n, today))
    .filter((resolved) => existsSync(join(memDir, `${resolved}.md`)))
    .map((resolved) => {
      const filePath = join(memDir, `${resolved}.md`);
      if (resolved.startsWith("daily_notes/")) {
        const content = readFileSync(filePath, "utf8");
        return `<memory file="${resolved}.md">\n<body>${content.trim()}</body>\n</memory>`;
      }
      const m = readMemoryFile(dataDir, resolved);
      const fm = JSON.stringify(m.frontmatter, null, 2);
      return `<memory file="${resolved}.md">\n<frontmatter>${fm}</frontmatter>\n<body>${m.body.trim()}</body>\n</memory>`;
    });
  return { role: "user", content: `<memory_block>\n${blocks.join("\n")}\n</memory_block>` };
};

function summarizeToolResult(toolName: string, body: string): string {
  switch (toolName) {
    case "web_fetch":
      return "[tool:web_fetch → content fetched]";
    case "read_deliverable": {
      try {
        const obj = JSON.parse(body) as { title?: string; contentMd?: string };
        const words = obj.contentMd ? obj.contentMd.split(/\s+/).length : 0;
        return `[tool:read_deliverable → read "${obj.title ?? "unknown"}" (~${words} words)]`;
      } catch { return "[tool:read_deliverable → content read]"; }
    }
    case "delegate_to_lead":
    case "delegate_to_specialist": {
      try {
        const obj = JSON.parse(body) as { delegationId?: string };
        return `[tool:${toolName} → delegated (id: ${obj.delegationId ?? "?"})]`;
      } catch { return `[tool:${toolName} → delegated]`; }
    }
    case "submit_deliverable": {
      try {
        const obj = JSON.parse(body) as { id?: string; title?: string };
        return `[tool:submit_deliverable → submitted "${obj.title ?? "?"}" (id: ${obj.id ?? "?"})]`;
      } catch { return "[tool:submit_deliverable → submitted]"; }
    }
    default:
      return `[tool:${toolName}]\n${body}`;
  }
}

export function collapseToolPairs(messages: StandardMessage[]): StandardMessage[] {
  return messages.map((msg) => {
    if (msg.role !== "tool") return msg;
    const match = msg.content.match(/^\[tool:([^\]]+)\]\n?([\s\S]*)/);
    if (!match) return msg;
    const [, toolName, body] = match;
    return { ...msg, content: summarizeToolResult(toolName, body) };
  });
}

export function makeTransformContext(opts: TransformContextOptions) {
  const keepRecent = opts.keepRecent ?? 50;
  return async (messages: AgencyMessage[]): Promise<StandardMessage[]> => {
    const llmMessages = convertToLlm(messages);
    const head = memoryBlock(opts.dataDir, opts.role);
    if (llmMessages.length <= keepRecent) return [head, ...llmMessages];
    const old = llmMessages.slice(0, llmMessages.length - keepRecent);
    const recent = llmMessages.slice(llmMessages.length - keepRecent);
    return [head, ...collapseToolPairs(old), ...recent];
  };
}
