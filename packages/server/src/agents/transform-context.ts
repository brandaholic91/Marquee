import { existsSync, readdirSync } from "node:fs";
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
	director: ["client_profile", "brand_guidelines", "ongoing_campaigns"],
	"content-lead": ["client_profile", "brand_guidelines", "content_history"],
	copywriter: ["client_profile", "brand_guidelines", "content_history"],
	"eval-judge": ["client_profile", "brand_guidelines"],
};

const memoryBlock = (dataDir: string, role: string): StandardMessage => {
	const memDir = join(dataDir, "memory");
	if (!existsSync(memDir)) return { role: "user", content: "<memory/>" };
	const want = RELEVANT_MEMORY_FOR_ROLE[role] ?? ["client_profile", "brand_guidelines"];
	const present = new Set(readdirSync(memDir).map((f) => f.replace(/\.md$/, "")));
	const blocks = want
		.filter((n) => present.has(n))
		.map((n) => {
			const m = readMemoryFile(dataDir, n);
			const fm = JSON.stringify(m.frontmatter, null, 2);
			return `<memory file="${n}.md">\n<frontmatter>${fm}</frontmatter>\n<body>${m.body.trim()}</body>\n</memory>`;
		});
	return { role: "user", content: `<memory_block>\n${blocks.join("\n")}\n</memory_block>` };
};

const summarize = (toCompact: StandardMessage[]): StandardMessage => ({
	role: "user",
	content: `[earlier turns summarized: ${toCompact.length} messages omitted]`,
});

export function makeTransformContext(opts: TransformContextOptions) {
	const keepRecent = opts.keepRecent ?? 50;
	return async (messages: AgencyMessage[]): Promise<StandardMessage[]> => {
		const llmMessages = convertToLlm(messages);
		const head = memoryBlock(opts.dataDir, opts.role);
		if (llmMessages.length <= keepRecent) return [head, ...llmMessages];
		const old = llmMessages.slice(0, llmMessages.length - keepRecent);
		const recent = llmMessages.slice(llmMessages.length - keepRecent);
		return [head, summarize(old), ...recent];
	};
}
