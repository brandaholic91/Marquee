import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { openDb } from "../../db/index.js";
import { Broker } from "../../broker/event-bus.js";
import { buildServer } from "../index.js";
import { briefs, campaigns } from "../../db/schema.js";
import type { AgentRouter } from "../../broker/router.js";

function makeApp() {
	const dir = mkdtempSync(join(tmpdir(), "briefs-test-"));
	mkdirSync(join(dir, "memory"), { recursive: true });
	const { db, close } = openDb(join(dir, "test.db"));
	const broker = new Broker(db);
	const router = { queueBrief: () => {} } as unknown as AgentRouter;
	return {
		db,
		broker,
		dir,
		router,
		close,
		cleanup: () => {
			close();
			rmSync(dir, { recursive: true, force: true });
		},
	};
}

describe("POST /api/briefs", () => {
	it("creates a campaign from the first line of contentMd", async () => {
		const { db, broker, dir, router, cleanup } = makeApp();
		const app = await buildServer({
			db,
			broker,
			router,
			dataDir: dir,
			webRoot: "/nonexistent",
		});
		const res = await app.inject({
			method: "POST",
			url: "/api/briefs",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				contentMd: "# Q2 LinkedIn Series\n\nWrite 5 posts about product features.",
			}),
		});
		expect(res.statusCode).toBe(200);
		const body = res.json<{ id: string; ok: boolean }>();
		const brief = db
			.select()
			.from(briefs)
			.all()
			.find((b) => b.id === body.id)!;
		expect(brief.campaignId).toBeDefined();
		const campaign = db
			.select()
			.from(campaigns)
			.all()
			.find((c) => c.id === brief.campaignId);
		expect(campaign?.title).toBe("Q2 LinkedIn Series");
		expect(campaign?.status).toBe("active");
		cleanup();
	});

	it("uses date fallback when contentMd has no header line", async () => {
		const { db, broker, dir, router, cleanup } = makeApp();
		const app = await buildServer({
			db,
			broker,
			router,
			dataDir: dir,
			webRoot: "/nonexistent",
		});
		const res = await app.inject({
			method: "POST",
			url: "/api/briefs",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ contentMd: "Write some content." }),
		});
		expect(res.statusCode).toBe(200);
		const body = res.json<{ id: string }>();
		const brief = db
			.select()
			.from(briefs)
			.all()
			.find((b) => b.id === body.id)!;
		const campaign = db
			.select()
			.from(campaigns)
			.all()
			.find((c) => c.id === brief.campaignId);
		expect(campaign?.title).toMatch(/^Brief \d{4}-\d{2}-\d{2}$/);
		cleanup();
	});
});
