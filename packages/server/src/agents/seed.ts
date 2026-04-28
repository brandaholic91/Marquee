import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function seedDefaultAgentIdentities(dataDir: string): void {
	const defaultsDir = join(dirname(fileURLToPath(import.meta.url)), "defaults");
	if (!existsSync(defaultsDir)) return;

	for (const entry of ["director", "content-lead", "distribution-lead", "insights-lead",
		"copywriter", "social-manager", "seo-analyst", "eval-judge",
		"paid-specialist", "repurposer", "analytics-analyst"]) {
		const src = join(defaultsDir, entry, "identity.md");
		if (!existsSync(src)) continue;
		const dest = join(dataDir, "agents", entry, "identity.md");
		if (existsSync(dest)) continue;
		mkdirSync(join(dataDir, "agents", entry), { recursive: true });
		cpSync(src, dest);
	}
}
