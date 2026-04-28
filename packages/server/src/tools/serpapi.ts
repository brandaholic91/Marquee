import { z } from "zod";
import type { AgentToolDef } from "./types.js";

const serpApiSearchInput = z.object({
	query: z.string().min(1),
	num: z.number().int().positive().max(20).optional(),
});

export const serpApiSearch: AgentToolDef<
	z.infer<typeof serpApiSearchInput>,
	{
		results: { title: string; url: string; snippet: string }[];
		_stub: boolean;
	}
> = {
	name: "serpapi_search",
	description:
		"Search the web via SerpAPI. Returns stub data when SERPAPI_KEY env var is not set.",
	schema: {
		type: "object",
		properties: {
			query: { type: "string", minLength: 1 },
			num: { type: "integer", minimum: 1, maximum: 20 },
		},
		required: ["query"],
	},
	input: serpApiSearchInput,
	async execute(input) {
		const key = process.env.SERPAPI_KEY;
		if (!key) {
			return { results: [], _stub: true };
		}
		const params = new URLSearchParams({
			q: input.query,
			num: String(input.num ?? 10),
			api_key: key,
		});
		const res = await fetch(`https://serpapi.com/search.json?${params}`);
		const data = (await res.json()) as {
			organic_results?: { title: string; link: string; snippet: string }[];
		};
		const results = (data.organic_results ?? []).map((r) => ({
			title: r.title,
			url: r.link,
			snippet: r.snippet,
		}));
		return { results, _stub: false };
	},
};
