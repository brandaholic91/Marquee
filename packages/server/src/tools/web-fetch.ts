export interface WebFetchInput {
	urls: string[];
}

export function makeWebFetchTool() {
	return {
		name: "web_fetch",
		description:
			"Töltsd le egy vagy több weboldal teljes szöveges tartalmát. Használd Google Trends oldalak, fórumok, konkurencia oldalak tartalmának kiolvasására. Maximum 5 URL-t adj meg egyszerre.",
		inputSchema: {
			type: "object" as const,
			properties: {
				urls: {
					type: "array",
					items: { type: "string" },
					description: "A letöltendő URL-ek listája (max 5)",
					minItems: 1,
					maxItems: 5,
				},
			},
			required: ["urls"],
		},
		execute: async (input: WebFetchInput) => {
			const apiKey = process.env.TAVILY_API_KEY;
			if (!apiKey) throw new Error("TAVILY_API_KEY környezeti változó nincs beállítva");

			const res = await fetch("https://api.tavily.com/extract", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({ urls: input.urls }),
				signal: AbortSignal.timeout(30_000),
			});

			if (!res.ok) {
				throw new Error(`Tavily extract API hiba: ${res.status} ${res.statusText}`);
			}

			return res.json();
		},
	};
}
