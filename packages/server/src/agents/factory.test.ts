import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { makeAgent } from "./factory.js";
import type { Agent } from "@mariozechner/pi-agent-core";

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

	it("creates an Agent without throwing", () => {
		const agent = makeAgent({
			role: "copywriter",
			dataDir: dir,
			db,
			sessionId: "s1",
			emit: () => {},
		});
		expect(agent).toBeDefined();
	});

	it("returns an Agent instance", () => {
		const { Agent } = require("@mariozechner/pi-agent-core");
		const agent = makeAgent({
			role: "copywriter",
			dataDir: dir,
			db,
			sessionId: "s1",
			emit: () => {},
		});
		expect(agent).toBeInstanceOf(Agent);
	});

	it("assigns a model with provider and id", () => {
		const agent = makeAgent({
			role: "copywriter",
			dataDir: dir,
			db,
			sessionId: "s1",
			emit: () => {},
		});
		const model = agent.state.model;
		expect(model).toHaveProperty("provider");
		expect(model).toHaveProperty("id");
		expect(model.provider).toBeTruthy();
		expect(model.id).toBeTruthy();
	});

	it("copywriter gets submit_deliverable tool but not delegate_to_lead", () => {
		const agent = makeAgent({
			role: "copywriter",
			dataDir: dir,
			db,
			sessionId: "s1",
			emit: () => {},
		});
		const toolNames = agent.state.tools.map((t) => t.name);
		expect(toolNames).toContain("submit_deliverable");
		expect(toolNames).not.toContain("delegate_to_lead");
	});

	it("director gets delegate_to_lead tool but not submit_deliverable", () => {
		const agent = makeAgent({
			role: "director",
			dataDir: dir,
			db,
			sessionId: "s2",
			emit: () => {},
		});
		const toolNames = agent.state.tools.map((t) => t.name);
		expect(toolNames).toContain("delegate_to_lead");
		expect(toolNames).not.toContain("submit_deliverable");
	});

	it("system prompt includes role and skill list (not full body)", () => {
		const agent = makeAgent({
			role: "copywriter",
			dataDir: dir,
			db,
			sessionId: "s1",
			emit: () => {},
		});
		expect(agent.state.systemPrompt).toContain("copywriter");
		// Skill list with name and when_to_use — body is loaded on demand via use_skill
		expect(agent.state.systemPrompt).toContain("blog_post_writer");
		expect(agent.state.systemPrompt).toContain("use_skill");
		expect(agent.state.systemPrompt).not.toContain("Write for T");
	});

	it("exposes convertToLlm and transformContext functions on the agent", () => {
		const agent = makeAgent({
			role: "copywriter",
			dataDir: dir,
			db,
			sessionId: "s1",
			emit: () => {},
		});
		expect(typeof agent.convertToLlm).toBe("function");
		expect(typeof agent.transformContext).toBe("function");
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

	it("paid-specialist gets submit_deliverable but not delegate_to_lead", () => {
		const agent = makeAgent({
			role: "paid-specialist",
			dataDir: dir,
			db,
			sessionId: "s3",
			emit: () => {},
		});
		const names = agent.state.tools.map((t) => t.name);
		expect(names).toContain("submit_deliverable");
		expect(names).toContain("request_input");
		expect(names).not.toContain("delegate_to_lead");
		expect(names).not.toContain("delegate_to_specialist");
	});

	it("repurposer gets submit_deliverable but not request_input", () => {
		const agent = makeAgent({
			role: "repurposer",
			dataDir: dir,
			db,
			sessionId: "s4",
			emit: () => {},
		});
		const names = agent.state.tools.map((t) => t.name);
		expect(names).toContain("submit_deliverable");
		expect(names).toContain("respond_to_lead");
		expect(names).not.toContain("request_input");
		expect(names).not.toContain("delegate_to_specialist");
	});

	it("analytics-analyst gets query_matomo and serpapi_search", () => {
		const agent = makeAgent({
			role: "analytics-analyst",
			dataDir: dir,
			db,
			sessionId: "s5",
			emit: () => {},
		});
		const names = agent.state.tools.map((t) => t.name);
		expect(names).toContain("query_matomo");
		expect(names).toContain("serpapi_search");
		expect(names).toContain("submit_deliverable");
		expect(names).toContain("respond_to_lead");
		expect(names).not.toContain("delegate_to_specialist");
	});
});
