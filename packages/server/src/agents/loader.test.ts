import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	loadAgentIdentity,
	saveAgentIdentity,
	loadAgentConfig,
	saveAgentConfig,
	loadAgentDescription,
} from "./loader.js";

describe("loadAgentIdentity", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "marquee-agent-loader-"));
		mkdirSync(join(dir, "agents/director"), { recursive: true });
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	it("returns identity body when file exists", () => {
		writeFileSync(join(dir, "agents/director/identity.md"), "You are the Director.\n\nMore text.");
		expect(loadAgentIdentity(dir, "director")).toContain("You are the Director.");
	});

	it("strips frontmatter if present", () => {
		writeFileSync(
			join(dir, "agents/director/identity.md"),
			"---\ntitle: Director\n---\n\nYou are the Director.",
		);
		const out = loadAgentIdentity(dir, "director");
		expect(out).toContain("You are the Director.");
		expect(out).not.toContain("title: Director");
	});

	it("returns empty string when file missing", () => {
		expect(loadAgentIdentity(dir, "director")).toBe("");
	});
});

describe("saveAgentIdentity", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "marquee-agent-save-"));
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	it("writes the body to identity.md", () => {
		saveAgentIdentity(dir, "director", "You are the Director.");
		expect(readFileSync(join(dir, "agents/director/identity.md"), "utf8")).toBe(
			"You are the Director.",
		);
	});

	it("creates the directory if missing", () => {
		saveAgentIdentity(dir, "new-role", "body");
		expect(existsSync(join(dir, "agents/new-role/identity.md"))).toBe(true);
	});
});

describe("loadAgentConfig + saveAgentConfig", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "marquee-agent-cfg-"));
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	it("returns empty object when config.json missing", () => {
		expect(loadAgentConfig(dir, "director")).toEqual({});
	});

	it("round-trips model and thinking_level", () => {
		saveAgentConfig(dir, "director", { model: "gpt-5.4", thinking_level: "low" });
		expect(loadAgentConfig(dir, "director")).toEqual({
			model: "gpt-5.4",
			thinking_level: "low",
		});
	});
});

describe("loadAgentDescription", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "marquee-agent-desc-"));
		mkdirSync(join(dir, "agents/director"), { recursive: true });
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	it("returns first non-empty paragraph, max 100 chars", () => {
		writeFileSync(
			join(dir, "agents/director/identity.md"),
			"\n\nYou are the Director agent. You orchestrate everything.\n\nMore details here.",
		);
		const desc = loadAgentDescription(dir, "director");
		expect(desc).toContain("You are the Director agent.");
		expect(desc.length).toBeLessThanOrEqual(100);
		expect(desc).not.toContain("More details here.");
	});

	it("strips markdown headings from description", () => {
		writeFileSync(join(dir, "agents/director/identity.md"), "## Role\n\nYou are the Director.");
		const desc = loadAgentDescription(dir, "director");
		expect(desc).not.toContain("##");
	});

	it("returns empty string when identity.md missing", () => {
		expect(loadAgentDescription(dir, "director")).toBe("");
	});
});
