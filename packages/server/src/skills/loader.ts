import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { interpolate } from "../memory/template.js";

export interface SkillRecipe {
	frontmatter: Record<string, unknown>;
	body: string;
	render(ctx: Record<string, unknown>): string;
}

const skillsDir = (dataDir: string) => join(dataDir, "skills");

export function loadSkill(dataDir: string, role: string, name: string): SkillRecipe {
	const path = join(skillsDir(dataDir), role, `${name}.md`);
	const raw = readFileSync(path, "utf8");
	const parsed = matter(raw);
	return {
		frontmatter: parsed.data as Record<string, unknown>,
		body: parsed.content,
		render: (ctx) => interpolate(parsed.content, ctx),
	};
}

export function loadSkillsForRole(dataDir: string, role: string): SkillRecipe[] {
	const dir = join(skillsDir(dataDir), role);
	let files: string[];
	try {
		files = readdirSync(dir).filter((f) => f.endsWith(".md"));
	} catch {
		return [];
	}
	return files.map((f) => loadSkill(dataDir, role, f.replace(/\.md$/, "")));
}
