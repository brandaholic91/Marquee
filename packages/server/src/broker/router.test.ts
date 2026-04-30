import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dispatchBrief, composePrompt } from "./router.js";
import * as schema from "../db/schema.js";

vi.mock("@mariozechner/pi-agent-core", () => ({
	Agent: class FakeAgent {
		constructor(public opts: any) {}
		async prompt() {
			/* simulate specialist completion via direct DB writes */
		}
	},
}));

let db: ReturnType<typeof drizzle>;
let baseDir: string;
const broker = { emit: vi.fn() };

beforeEach(async () => {
	baseDir = mkdtempSync(join(tmpdir(), "marquee-rt-"));
	const sqlite = new Database(":memory:");
	db = drizzle(sqlite, { schema });
	await migrate(db, { migrationsFolder: "drizzle" });
	await db.insert(schema.clients).values({ slug: "default", name: "D", createdAt: Date.now() });
	await db.insert(schema.briefs).values({
		id: "br_1",
		clientSlug: "default",
		sourceThreadId: null,
		contentMd: JSON.stringify({
			title: "t",
			body: "b",
			deliverable_type: "social_post",
			target_specialist: "social-manager",
			platform: "instagram",
		}),
		status: "draft",
		createdAt: Date.now(),
		dispatchedAt: null,
	});
	broker.emit.mockClear();
});

describe("dispatchBrief", () => {
	it("marks brief dispatched, creates delegation, spawns specialist", async () => {
		await dispatchBrief({ db, broker, dataDir: baseDir, briefId: "br_1" });
		const briefs = await db.select().from(schema.briefs).all();
		expect(briefs[0].status).toBe("dispatched");
		expect(briefs[0].dispatchedAt).not.toBeNull();
		const dels = await db.select().from(schema.delegations).all();
		expect(dels).toHaveLength(1);
		expect(dels[0].toAgent).toBe("social-manager");
		expect(dels[0].fromAgent).toBe("director");
		expect(broker.emit).toHaveBeenCalledWith(expect.objectContaining({ type: "brief_dispatched", brief_id: "br_1" }));
		expect(broker.emit).toHaveBeenCalledWith(expect.objectContaining({ type: "delegation_started" }));
	});

	it("throws on already-dispatched brief", async () => {
		await dispatchBrief({ db, broker, dataDir: baseDir, briefId: "br_1" });
		await expect(dispatchBrief({ db, broker, dataDir: baseDir, briefId: "br_1" })).rejects.toThrow(
			/already dispatched/,
		);
	});
});

describe("composePrompt", () => {
	it("includes parent deliverable block when parentContent is provided", () => {
		const payload = {
			title: "SEO cikk",
			body: "Írj cikket",
			deliverable_type: "blog_post" as const,
			target_specialist: "copywriter" as const,
			platform: null,
			skill: "seo_article_writer",
		};
		const result = composePrompt(payload, "# SEO Brief\nprimary_keyword: growth hacking");
		expect(result).toContain("=== FORRÁS DELIVERABLE ===");
		expect(result).toContain("primary_keyword: growth hacking");
		expect(result).toContain("=== AKTUÁLIS BRIEF ===");
		expect(result).toContain("SEO cikk");
	});

	it("omits the source block when no parentContent", () => {
		const payload = {
			title: "Blog post",
			body: "Írj cikket",
			deliverable_type: "blog_post" as const,
			target_specialist: "copywriter" as const,
			platform: null,
			skill: null,
		};
		const result = composePrompt(payload);
		expect(result).not.toContain("=== FORRÁS DELIVERABLE ===");
		expect(result).toContain("=== AKTUÁLIS BRIEF ===");
	});
});
