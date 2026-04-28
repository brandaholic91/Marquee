import { z } from "zod";
import type { AgentToolDef } from "./types.js";

const queryMatomoInput = z.object({
	site_id: z.number().int().positive(),
	period: z.enum(["day", "week", "month"]),
	date: z.string().min(1),
});

export const queryMatomo: AgentToolDef<
	z.infer<typeof queryMatomoInput>,
	{
		visits: { date: string; count: number }[];
		pageviews: number | null;
		bounceRate: number | null;
		topPages: { url: string; views: number }[];
		_stub: boolean;
	}
> = {
	name: "query_matomo",
	description:
		"Query Matomo analytics for visit stats. Returns stub data when MATOMO_URL/MATOMO_TOKEN env vars are not set.",
	schema: {
		type: "object",
		properties: {
			site_id: { type: "integer", minimum: 1 },
			period: { type: "string", enum: ["day", "week", "month"] },
			date: { type: "string", description: '"today", "yesterday", or "YYYY-MM-DD"' },
		},
		required: ["site_id", "period", "date"],
	},
	input: queryMatomoInput,
	async execute(input) {
		const url = process.env.MATOMO_URL;
		const token = process.env.MATOMO_TOKEN;
		if (!url || !token) {
			return { visits: [], pageviews: null, bounceRate: null, topPages: [], _stub: true };
		}
		const params = new URLSearchParams({
			module: "API",
			method: "VisitsSummary.get",
			idSite: String(input.site_id),
			period: input.period,
			date: input.date,
			token_auth: token,
			format: "JSON",
		});
		const res = await fetch(`${url}/index.php?${params}`);
		const data = (await res.json()) as {
			nb_visits?: number;
			nb_pageviews?: number;
			bounce_rate?: string;
		};
		return {
			visits: [{ date: input.date, count: data.nb_visits ?? 0 }],
			pageviews: data.nb_pageviews ?? null,
			bounceRate: data.bounce_rate ? parseFloat(data.bounce_rate) : null,
			topPages: [],
			_stub: false,
		};
	},
};
