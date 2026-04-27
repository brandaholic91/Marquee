import { z } from "zod";
import { readMemoryFile } from "../memory/read.js";
import type { AgentToolDef } from "./types.js";

const ALLOWED_MEMORY = new Set([
	"client_profile", "brand_guidelines", "ongoing_campaigns", "content_history",
]);

const readMemoryInput = z.object({ file: z.string() });

export function makeReadMemory(dataDir: string): AgentToolDef<
	z.infer<typeof readMemoryInput>,
	{ frontmatter: Record<string, unknown>; body: string }
> {
	return {
		name: "read_memory",
		description: "Read the current contents of a memory file. Returns parsed frontmatter and body.",
		schema: {
			type: "object",
			properties: {
				file: { type: "string" },
			},
			required: ["file"],
		},
		input: readMemoryInput,
		async execute(input) {
			if (!ALLOWED_MEMORY.has(input.file))
				throw new Error(`memory file "${input.file}" not allowed. Allowed: ${[...ALLOWED_MEMORY].join(", ")}`);
			const m = readMemoryFile(dataDir, input.file);
			return { frontmatter: m.frontmatter, body: m.body };
		},
	};
}

const webFetchInput = z.object({ url: z.string().url() });

export const webFetch: AgentToolDef<
	z.infer<typeof webFetchInput>,
	{ status: number; text: string; contentType: string | null }
> = {
	name: "web_fetch",
	description: "GET a URL and return its text content. Use sparingly.",
	schema: {
		type: "object",
		properties: {
			url: { type: "string", format: "uri" },
		},
		required: ["url"],
	},
	input: webFetchInput,
	async execute(input) {
		const res = await fetch(input.url, {
			headers: { "User-Agent": "agency-orchestrator/0.1" },
		});
		const text = await res.text();
		return { status: res.status, text: text.slice(0, 200_000), contentType: res.headers.get("content-type") };
	},
};
