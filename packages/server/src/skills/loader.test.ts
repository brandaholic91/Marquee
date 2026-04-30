import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import matter from "gray-matter";
import { loadSkill, loadSkillBody, loadSkillsForRole, listSkillsForRole, loadSkillRecipes, loadSkillCatalog, saveSkill, deleteSkill, loadBrandVoiceInstruction } from "./loader.js";

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

describe("loadSkillRecipes", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "marquee-recipes-"));
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	it("returns concatenated markdown for a role, sorted by filename", async () => {
		mkdirSync(join(dir, "skills/director"), { recursive: true });
		writeFileSync(join(dir, "skills/director/b_second.md"), "# Second\nbody2");
		writeFileSync(join(dir, "skills/director/a_first.md"), "# First\nbody1");
		const out = await loadSkillRecipes(dir, "director");
		const idx1 = out.indexOf("First");
		const idx2 = out.indexOf("Second");
		expect(idx1).toBeGreaterThanOrEqual(0);
		expect(idx2).toBeGreaterThan(idx1);
		expect(out).toContain("---");
	});

	it("returns empty string when role directory missing", async () => {
		const out = await loadSkillRecipes(dir, "ghost-role");
		expect(out).toBe("");
	});
});

describe("loadSkillRecipes — _common brand voice injection", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "marquee-loader-"));
		mkdirSync(join(dir, "skills", "copywriter"), { recursive: true });
		mkdirSync(join(dir, "skills", "_common"), { recursive: true });
		writeFileSync(
			join(dir, "skills", "copywriter", "blog_post_writer.md"),
			"---\nname: blog_post_writer\n---\nWrite a blog post.",
		);
		writeFileSync(
			join(dir, "skills", "_common", "brand_voice_instruction.md"),
			"## Brand voice\nFollow the guidelines.",
		);
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	it("appends brand_voice_instruction to non-guardian roles", async () => {
		const result = await loadSkillRecipes(dir, "copywriter");
		expect(result).toContain("Write a blog post.");
		expect(result).toContain("Follow the guidelines.");
	});

	it("does NOT append brand_voice_instruction to brand-voice-guardian", async () => {
		mkdirSync(join(dir, "skills", "brand-voice-guardian"), { recursive: true });
		writeFileSync(
			join(dir, "skills", "brand-voice-guardian", "brand_voice_review.md"),
			"---\nname: brand_voice_review\n---\nReview the content.",
		);
		const result = await loadSkillRecipes(dir, "brand-voice-guardian");
		expect(result).toContain("Review the content.");
		expect(result).not.toContain("Follow the guidelines.");
	});

	it("works fine when _common/brand_voice_instruction.md does not exist", async () => {
		rmSync(join(dir, "skills", "_common"), { recursive: true });
		const result = await loadSkillRecipes(dir, "copywriter");
		expect(result).toContain("Write a blog post.");
	});
});

describe("loadSkillCatalog", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "marquee-catalog-"));
		mkdirSync(join(dir, "skills/director"), { recursive: true });
		writeFileSync(
			join(dir, "skills/director/brief_parser.md"),
			"---\nname: brief_parser\ndescription: Parses incoming briefs\n---\n\nBody text here.",
		);
		writeFileSync(
			join(dir, "skills/director/lead_router.md"),
			"---\nname: lead_router\ndescription: Routes to correct lead\n---\n\nRouter body.",
		);
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	it("returns XML with name and description only, no body", () => {
		const out = loadSkillCatalog(dir, "director");
		expect(out).toContain('<skill name="brief_parser">Parses incoming briefs</skill>');
		expect(out).toContain('<skill name="lead_router">Routes to correct lead</skill>');
		expect(out).not.toContain("Body text here");
		expect(out).not.toContain("Router body");
	});

	it("wraps in <skills> element", () => {
		const out = loadSkillCatalog(dir, "director");
		expect(out).toMatch(/^<skills>/);
		expect(out).toMatch(/<\/skills>$/);
	});

	it("returns empty string for unknown role", () => {
		expect(loadSkillCatalog(dir, "ghost")).toBe("");
	});

	it("sorts skills alphabetically by filename", () => {
		const out = loadSkillCatalog(dir, "director");
		expect(out.indexOf("brief_parser")).toBeLessThan(out.indexOf("lead_router"));
	});
});

describe("saveSkill + deleteSkill", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "marquee-skill-write-"));
		mkdirSync(join(dir, "skills/copywriter"), { recursive: true });
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	it("saveSkill writes a parseable .md file", () => {
		saveSkill(dir, "copywriter", "my_skill", "Does something useful", "Step 1: do the thing.");
		const raw = readFileSync(join(dir, "skills/copywriter/my_skill.md"), "utf8");
		const parsed = matter(raw);
		expect(parsed.data.name).toBe("my_skill");
		expect(parsed.data.description).toBe("Does something useful");
		expect(parsed.content.trim()).toBe("Step 1: do the thing.");
	});

	it("saveSkill creates the role directory if missing", () => {
		saveSkill(dir, "new-role", "a_skill", "desc", "body");
		expect(existsSync(join(dir, "skills/new-role/a_skill.md"))).toBe(true);
	});

	it("deleteSkill removes the file", () => {
		saveSkill(dir, "copywriter", "to_delete", "desc", "body");
		deleteSkill(dir, "copywriter", "to_delete");
		expect(existsSync(join(dir, "skills/copywriter/to_delete.md"))).toBe(false);
	});

	it("deleteSkill is silent for nonexistent skill", () => {
		expect(() => deleteSkill(dir, "copywriter", "ghost")).not.toThrow();
	});
});

describe("loadBrandVoiceInstruction", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "marquee-bvi-"));
		mkdirSync(join(dir, "skills/_common"), { recursive: true });
		writeFileSync(
			join(dir, "skills/_common/brand_voice_instruction.md"),
			"---\nname: bvi\n---\n\nFollow brand voice guidelines.",
		);
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	it("returns body (no frontmatter) for non-guardian roles", () => {
		const out = loadBrandVoiceInstruction(dir, "copywriter");
		expect(out).toContain("Follow brand voice guidelines.");
		expect(out).not.toContain("name: bvi");
	});

	it("returns empty string for brand-voice-guardian", () => {
		expect(loadBrandVoiceInstruction(dir, "brand-voice-guardian")).toBe("");
	});

	it("returns empty string when file is missing", () => {
		rmSync(join(dir, "skills/_common"), { recursive: true });
		expect(loadBrandVoiceInstruction(dir, "copywriter")).toBe("");
	});
});
