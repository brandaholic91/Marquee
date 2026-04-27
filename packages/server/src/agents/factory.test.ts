import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { makeAgent } from "./factory.js";

describe("agent factory", () => {
	let dir: string;
	let db: AgencyDb;
	let close: () => void;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-factory-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
		mkdirSync(join(dir, "memory"));
		writeFileSync(
			join(dir, "memory/client_profile.md"),
			"---\nclient_name: T\n---\nbody",
		);
		writeFileSync(
			join(dir, "memory/brand_guidelines.md"),
			"---\ntone_of_voice: x\n---\nb",
		);
		mkdirSync(join(dir, "skills/copywriter"), { recursive: true });
		writeFileSync(
			join(dir, "skills/copywriter/blog_post_writer.md"),
			"---\nname: blog_post_writer\n---\nWrite for {{client_profile.client_name}}.",
		);
	});

	afterEach(() => {
		close();
		rmSync(dir, { recursive: true, force: true });
	});

	it("creates an AgentConfig without throwing", () => {
		const cfg = makeAgent({
			role: "copywriter",
			dataDir: dir,
			db,
			sessionId: "s1",
			emit: () => {},
		});
		expect(cfg).toBeDefined();
	});

	it("has the correct role and sessionId", () => {
		const cfg = makeAgent({
			role: "copywriter",
			dataDir: dir,
			db,
			sessionId: "s1",
			emit: () => {},
		});
		expect(cfg.role).toBe("copywriter");
		expect(cfg.sessionId).toBe("s1");
	});

	it("assigns a model descriptor", () => {
		const cfg = makeAgent({
			role: "copywriter",
			dataDir: dir,
			db,
			sessionId: "s1",
			emit: () => {},
		});
		expect(cfg.model).toHaveProperty("provider");
		expect(cfg.model).toHaveProperty("id");
		expect(cfg.model.provider).toBeTruthy();
		expect(cfg.model.id).toBeTruthy();
	});

	it("copywriter gets submit_deliverable tool but not delegate_to_lead", () => {
		const cfg = makeAgent({
			role: "copywriter",
			dataDir: dir,
			db,
			sessionId: "s1",
			emit: () => {},
		});
		const toolNames = cfg.tools.map((t) => t.name);
		expect(toolNames).toContain("submit_deliverable");
		expect(toolNames).not.toContain("delegate_to_lead");
	});

	it("director gets delegate_to_lead tool but not submit_deliverable", () => {
		const cfg = makeAgent({
			role: "director",
			dataDir: dir,
			db,
			sessionId: "s2",
			emit: () => {},
		});
		const toolNames = cfg.tools.map((t) => t.name);
		expect(toolNames).toContain("delegate_to_lead");
		expect(toolNames).not.toContain("submit_deliverable");
	});

	it("system prompt includes role and skill recipe", () => {
		const cfg = makeAgent({
			role: "copywriter",
			dataDir: dir,
			db,
			sessionId: "s1",
			emit: () => {},
		});
		expect(cfg.systemPrompt).toContain("copywriter");
		// Skill recipe body should be rendered with memory context
		expect(cfg.systemPrompt).toContain("blog_post_writer");
		expect(cfg.systemPrompt).toContain("Write for T");
	});

	it("exposes convertToLlm and transformContext functions", () => {
		const cfg = makeAgent({
			role: "copywriter",
			dataDir: dir,
			db,
			sessionId: "s1",
			emit: () => {},
		});
		expect(typeof cfg.convertToLlm).toBe("function");
		expect(typeof cfg.transformContext).toBe("function");
	});

	it("throws for unknown role", () => {
		expect(() =>
			makeAgent({
				role: "unknown-role",
				dataDir: dir,
				db,
				sessionId: "s1",
				emit: () => {},
			}),
		).toThrow();
	});
});
