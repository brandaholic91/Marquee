import { describe, it, expect, vi } from "vitest";
import { makeTavilySearchTool } from "./tavily-search.js";

function fakeFetch(body: unknown) {
	return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

describe("tavily_search", () => {
	it("calls Tavily /search with API key from env", async () => {
		process.env.TAVILY_API_KEY = "test-key";
		const fetchSpy = vi
			.fn()
			.mockImplementation(() =>
				fakeFetch({ results: [{ title: "t", url: "u", content: "c", score: 0.9 }], response_time: 0.1 }),
			);
		vi.stubGlobal("fetch", fetchSpy);

		const tool = makeTavilySearchTool();
		const result = await tool.execute({ query: "saas onboarding" });

		expect(result.results).toHaveLength(1);
		expect(fetchSpy).toHaveBeenCalledWith(
			"https://api.tavily.com/search",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
			}),
		);
		vi.unstubAllGlobals();
		delete process.env.TAVILY_API_KEY;
	});

	it("returns clear error when TAVILY_API_KEY is missing", async () => {
		delete process.env.TAVILY_API_KEY;
		const tool = makeTavilySearchTool();
		await expect(tool.execute({ query: "test" })).rejects.toThrow("TAVILY_API_KEY");
	});

	it("throws on Tavily API error response", async () => {
		process.env.TAVILY_API_KEY = "test-key";
		vi.stubGlobal("fetch", () => Promise.resolve(new Response("unauthorized", { status: 401 })));
		const tool = makeTavilySearchTool();
		await expect(tool.execute({ query: "test" })).rejects.toThrow("401");
		vi.unstubAllGlobals();
		delete process.env.TAVILY_API_KEY;
	});
});
