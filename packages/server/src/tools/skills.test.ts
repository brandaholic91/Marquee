import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeUseSkill } from "./skills.js";
import type { ToolContext } from "./types.js";

const fakeCtx = (role: string): ToolContext => ({
	db: {} as never,
	agentSlug: role,
	agentSessionId: "sess-1",
	emit: () => {},
});

describe("use_skill tool", () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-skills-"));
		mkdirSync(join(dir, "skills/copywriter"), { recursive: true });
		writeFileSync(
			join(dir, "skills/copywriter/blog_post_writer.md"),
			`---\nname: blog_post_writer\ndescription: blog_post delegation\n---\n\nWrite every blog post with this structure.\n`,
		);
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	it("returns skill body when skill exists", async () => {
		const tool = makeUseSkill(dir);
		const result = await tool.execute({ name: "blog_post_writer" }, fakeCtx("copywriter"));
		expect(result).toContain("Write every blog post");
		expect(result).not.toContain("description");
	});

	it("returns error with available skills when skill not found", async () => {
		const tool = makeUseSkill(dir);
		const result = await tool.execute({ name: "nonexistent" }, fakeCtx("copywriter"));
		expect(result).toContain("not found");
		expect(result).toContain("blog_post_writer");
	});

	it("returns error when role has no skills", async () => {
		const tool = makeUseSkill(dir);
		const result = await tool.execute({ name: "any_skill" }, fakeCtx("director"));
		expect(result).toContain("not found");
		expect(result).toContain("No skills available");
	});
});
