import { z } from "zod";
import type { AgentToolDef } from "./types.js";

const tavilySearchInput = z.object({
	query: z.string().min(1),
	num: z.number().int().positive().max(20).optional(),
});

export const tavilySearch: AgentToolDef<
	z.infer<typeof tavilySearchInput>,
	{
		results: { title: string; url: string; snippet: string }[];
		_stub: boolean;
	}
> = {
	name: "tavily_search",
	description:
		"Search the web via Tavily AI. Returns stub data when TAVILY_API_KEY env var is not set.",
	schema: {
		type: "object",
		properties: {
			query: { type: "string", minLength: 1 },
			num: { type: "integer", minimum: 1, maximum: 20 },
		},
		required: ["query"],
	},
	input: tavilySearchInput,
	async execute(input) {
		const key = process.env.TAVILY_API_KEY;
		if (!key) {
			return { results: [], _stub: true };
		}
		const res = await fetch("https://api.tavily.com/search", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				api_key: key,
				query: input.query,
				max_results: input.num ?? 10,
				search_depth: "basic",
			}),
		});
		const data = (await res.json()) as {
			results?: { title: string; url: string; content: string }[];
		};
		const results = (data.results ?? []).map((r) => ({
			title: r.title,
			url: r.url,
			snippet: r.content?.slice(0, 300) ?? "",
		}));
		return { results, _stub: false };
	},
};
