import { cpSync, existsSync as fsExists, mkdirSync as fsMkdir, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { interpolate } from "../memory/template.js";

export interface SkillRecipe {
	frontmatter: Record<string, unknown>;
	body: string;
	render(ctx: Record<string, unknown>): string;
}

export interface SkillMeta {
	name: string;
	description: string;
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
		files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
	} catch {
		return [];
	}
	return files.map((f) => loadSkill(dataDir, role, f.replace(/\.md$/, "")));
}

export function listSkillsForRole(dataDir: string, role: string): SkillMeta[] {
	const dir = join(skillsDir(dataDir), role);
	let files: string[];
	try {
		files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
	} catch {
		return [];
	}
	return files.map((f) => {
		const raw = readFileSync(join(dir, f), "utf8");
		const parsed = matter(raw);
		return {
			name: (parsed.data.name as string) ?? f.replace(/\.md$/, ""),
			description: (parsed.data.description as string) ?? "",
		};
	});
}

export function loadSkillBody(dataDir: string, role: string, name: string): string | null {
	const path = join(skillsDir(dataDir), role, `${name}.md`);
	try {
		const raw = readFileSync(path, "utf8");
		return matter(raw).content.trim();
	} catch {
		return null;
	}
}

export function seedDefaultSkills(dataDir: string): void {
	const defaultsDir = join(dirname(fileURLToPath(import.meta.url)), "defaults");
	const targetDir = join(dataDir, "skills");
	if (!fsExists(defaultsDir)) return;
	if (!fsExists(targetDir)) fsMkdir(targetDir, { recursive: true });
	cpSync(defaultsDir, targetDir, { recursive: true, force: false });
}

// Stub: Task 23 will implement with role-scoped recipe rendering.
export async function loadSkillRecipes(_dataDir: string, _role: string): Promise<string> {
	return "";
}
