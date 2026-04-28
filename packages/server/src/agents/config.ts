import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

export function loadAgentIdentity(dataDir: string, role: string): string | null {
  const path = join(dataDir, "agents", role, "identity.md");
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8").trim();
}

export interface AgentConfig {
  style?: "terse" | "verbose" | "balanced";
  tone?: "authoritative" | "friendly" | "neutral";
  response_length?: "concise" | "detailed";
  language?: string;
  model?: string;
  thinking_level?: "off" | "minimal" | "low" | "medium" | "high";
}

export function loadAgentConfig(dataDir: string, role: string): AgentConfig | null {
  const path = join(dataDir, "agents", role, "config.md");
  if (!existsSync(path)) return null;
  const parsed = matter(readFileSync(path, "utf8"));
  return parsed.data as AgentConfig;
}

export function buildBehaviorBlock(config: AgentConfig): string {
  const lines = [
    config.style && `Style: ${config.style}`,
    config.tone && `Tone: ${config.tone}`,
    config.response_length && `Response length: ${config.response_length}`,
    config.language && `Language: ${config.language}`,
  ].filter(Boolean) as string[];

  return lines.length > 0 ? `## Behavior\n${lines.join(" | ")}\n` : "";
}
