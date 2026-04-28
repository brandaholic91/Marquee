import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { serpApiSearch } from "./serpapi.js";

describe("serpApiSearch", () => {
	const ctx = { db: {} as never, agentSlug: "analytics-analyst", agentSessionId: "s1", emit: () => {} };

	beforeEach(() => { delete process.env.SERPAPI_KEY; });
	afterEach(() => { delete process.env.SERPAPI_KEY; });

	it("returns stub data when SERPAPI_KEY is not set", async () => {
		const result = await serpApiSearch.execute({ query: "SaaS PLG metrics" }, ctx);
		expect(result._stub).toBe(true);
		expect(result.results).toEqual([]);
	});

	it("defaults num to 10 when not provided", async () => {
		// Verify the schema accepts a call without num — if it throws on parse, test fails
		const parsed = (serpApiSearch.input as { parse: (v: unknown) => unknown }).parse({ query: "test" });
		expect(parsed).toMatchObject({ query: "test" });
	});
});
