import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadSkill, loadSkillBody, loadSkillsForRole, listSkillsForRole } from "./loader.js";

describe("skills loader", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-skills-"));
		mkdirSync(join(dir, "skills/copywriter"), { recursive: true });
		writeFileSync(
			join(dir, "skills/copywriter/blog_post_writer.md"),
			`---\nname: blog_post_writer\ndescription: blog_post delegation\n---\n\nWrite for {{client_profile.brand_voice}}\n`,
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

	it("listSkillsForRole returns name and description only", () => {
		const meta = listSkillsForRole(dir, "copywriter");
		expect(meta).toHaveLength(1);
		expect(meta[0].name).toBe("blog_post_writer");
		expect(meta[0].description).toBe("blog_post delegation");
	});

	it("listSkillsForRole returns empty array for unknown role", () => {
		expect(listSkillsForRole(dir, "unknown-role")).toEqual([]);
	});

	it("loadSkillBody returns body without frontmatter", () => {
		const body = loadSkillBody(dir, "copywriter", "blog_post_writer");
		expect(body).toContain("Write for");
		expect(body).not.toContain("description");
	});

	it("loadSkillBody returns null for unknown skill", () => {
		expect(loadSkillBody(dir, "copywriter", "nonexistent")).toBeNull();
	});
});
