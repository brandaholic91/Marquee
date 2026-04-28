import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { queryMatomo } from "./matomo.js";

describe("queryMatomo", () => {
	const ctx = { db: {} as never, agentSlug: "analytics-analyst", agentSessionId: "s1", emit: () => {} };

	beforeEach(() => {
		delete process.env.MATOMO_URL;
		delete process.env.MATOMO_TOKEN;
	});

	afterEach(() => {
		delete process.env.MATOMO_URL;
		delete process.env.MATOMO_TOKEN;
	});

	it("returns stub data when env vars are missing", async () => {
		const result = await queryMatomo.execute(
			{ site_id: 1, period: "day", date: "today" },
			ctx,
		);
		expect(result._stub).toBe(true);
		expect(result.visits).toEqual([]);
		expect(result.pageviews).toBeNull();
		expect(result.bounceRate).toBeNull();
		expect(result.topPages).toEqual([]);
	});

	it("returns stub when only MATOMO_URL is set (no token)", async () => {
		process.env.MATOMO_URL = "https://analytics.example.com";
		const result = await queryMatomo.execute(
			{ site_id: 1, period: "week", date: "yesterday" },
			ctx,
		);
		expect(result._stub).toBe(true);
	});
});
