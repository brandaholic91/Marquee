import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const agentsDir = (dataDir: string) => join(dataDir, "agents");

export function loadAgentIdentity(dataDir: string, role: string): string {
	const path = join(agentsDir(dataDir), role, "identity.md");
	try {
		const raw = readFileSync(path, "utf8");
		return matter(raw).content.trim();
	} catch {
		return "";
	}
}

export function saveAgentIdentity(dataDir: string, role: string, body: string): void {
	const dir = join(agentsDir(dataDir), role);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "identity.md"), body, "utf8");
}

export interface AgentConfig {
	model?: string;
	thinking_level?: string;
}

export function loadAgentConfig(dataDir: string, role: string): AgentConfig {
	const path = join(agentsDir(dataDir), role, "config.json");
	try {
		return JSON.parse(readFileSync(path, "utf8")) as AgentConfig;
	} catch {
		return {};
	}
}

export function saveAgentConfig(dataDir: string, role: string, config: AgentConfig): void {
	const dir = join(agentsDir(dataDir), role);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "config.json"), JSON.stringify(config, null, 2), "utf8");
}

export function loadAgentDescription(dataDir: string, role: string): string {
	const path = join(agentsDir(dataDir), role, "identity.md");
	try {
		const parsed = matter(readFileSync(path, "utf8"));
		if (typeof parsed.data.description === "string" && parsed.data.description.trim()) {
			return parsed.data.description.trim();
		}
	} catch { /* fall through */ }
	return "";
}

export function seedDefaultAgents(dataDir: string): void {
	const defaultsDir = join(dirname(fileURLToPath(import.meta.url)), "defaults");
	if (!existsSync(defaultsDir)) return;
	for (const role of readdirSync(defaultsDir)) {
		const srcIdentity = join(defaultsDir, role, "identity.md");
		if (!existsSync(srcIdentity)) continue;
		const destDir = join(agentsDir(dataDir), role);
		const destIdentity = join(destDir, "identity.md");
		if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
		if (!existsSync(destIdentity)) cpSync(srcIdentity, destIdentity);
	}
}
