export interface TavilySearchInput {
	query: string;
	search_depth?: "basic" | "advanced";
	max_results?: number;
}

export function makeTavilySearchTool() {
	return {
		name: "tavily_search",
		description:
			"Keresés a weben a Tavily API segítségével. Visszaad releváns URL-eket, címeket és tartalmi kivonatokat. Használd kulcsszó-kutatáshoz, piaci trendek feltérképezéséhez, konkurencia elemzéshez.",
		inputSchema: {
			type: "object" as const,
			properties: {
				query: { type: "string", description: "A keresési kifejezés" },
				search_depth: {
					type: "string",
					enum: ["basic", "advanced"],
					description: "basic: gyorsabb, advanced: mélyebb. Default: basic",
				},
				max_results: {
					type: "number",
					description: "Maximális találatszám (1-20). Default: 5",
				},
			},
			required: ["query"],
		},
		execute: async (input: TavilySearchInput) => {
			const apiKey = process.env.TAVILY_API_KEY;
			if (!apiKey) throw new Error("TAVILY_API_KEY környezeti változó nincs beállítva");

			const res = await fetch("https://api.tavily.com/search", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					query: input.query,
					search_depth: input.search_depth ?? "basic",
					max_results: input.max_results ?? 5,
				}),
				signal: AbortSignal.timeout(15_000),
			});

			if (!res.ok) {
				throw new Error(`Tavily API hiba: ${res.status} ${res.statusText}`);
			}

			return res.json();
		},
	};
}
