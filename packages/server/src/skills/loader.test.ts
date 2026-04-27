import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadSkill, loadSkillsForRole } from "./loader.js";

describe("skills loader", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-skills-"));
		mkdirSync(join(dir, "skills/copywriter"), { recursive: true });
		writeFileSync(
			join(dir, "skills/copywriter/blog_post_writer.md"),
			`---\nname: blog_post_writer\nwhen_to_use: blog_post delegation\n---\n\nWrite for {{client_profile.brand_voice}}\n`,
		);
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	it("loads a recipe by name", () => {
		const r = loadSkill(dir, "copywriter", "blog_post_writer");
		expect(r.frontmatter.name).toBe("blog_post_writer");
		expect(r.body).toContain("Write for");
	});

	it("interpolates variables when rendered", () => {
		const r = loadSkill(dir, "copywriter", "blog_post_writer");
		const rendered = r.render({ client_profile: { brand_voice: "tight" } });
		expect(rendered).toContain("Write for tight");
	});

	it("loads all recipes for a role", () => {
		const all = loadSkillsForRole(dir, "copywriter");
		expect(all).toHaveLength(1);
	});
});
