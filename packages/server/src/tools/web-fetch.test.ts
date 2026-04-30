import { describe, it, expect, vi } from "vitest";
import { makeWebFetchTool } from "./web-fetch.js";

function fakeFetch(body: unknown) {
	return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

describe("web_fetch", () => {
	it("calls Tavily /extract with urls and API key", async () => {
		process.env.TAVILY_API_KEY = "test-key";
		const fetchSpy = vi.fn().mockImplementation(() =>
			fakeFetch({
				results: [{ url: "https://example.com", raw_content: "Example content" }],
				failed_results: [],
			}),
		);
		vi.stubGlobal("fetch", fetchSpy);

		const tool = makeWebFetchTool();
		const result = await tool.execute({ urls: ["https://example.com"] });

		expect(result.results).toHaveLength(1);
		expect(result.results[0].raw_content).toBe("Example content");
		expect(fetchSpy).toHaveBeenCalledWith(
			"https://api.tavily.com/extract",
			expect.objectContaining({
				method: "POST",
			}),
		);
		vi.unstubAllGlobals();
		delete process.env.TAVILY_API_KEY;
	});

	it("returns clear error when TAVILY_API_KEY is missing", async () => {
		delete process.env.TAVILY_API_KEY;
		const tool = makeWebFetchTool();
		await expect(tool.execute({ urls: ["https://example.com"] })).rejects.toThrow("TAVILY_API_KEY");
	});

	it("throws on Tavily extract API error", async () => {
		process.env.TAVILY_API_KEY = "test-key";
		vi.stubGlobal("fetch", () => Promise.resolve(new Response("bad request", { status: 400 })));
		const tool = makeWebFetchTool();
		await expect(tool.execute({ urls: ["bad"] })).rejects.toThrow("400");
		vi.unstubAllGlobals();
		delete process.env.TAVILY_API_KEY;
	});
});
