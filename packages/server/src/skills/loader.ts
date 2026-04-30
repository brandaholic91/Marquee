import { cpSync, existsSync as fsExists, mkdirSync as fsMkdir, readdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
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
		files = readdirSync(dir)
			.filter((f) => f.endsWith(".md"))
			.sort();
	} catch {
		return [];
	}
	return files.map((f) => loadSkill(dataDir, role, f.replace(/\.md$/, "")));
}

export function listSkillsForRole(dataDir: string, role: string): SkillMeta[] {
	const dir = join(skillsDir(dataDir), role);
	let files: string[];
	try {
		files = readdirSync(dir)
			.filter((f) => f.endsWith(".md"))
			.sort();
	} catch {
		return [];
	}
	return files.map((f) => {
		const raw = readFileSync(join(dir, f), "utf8");
		const parsed = matter(raw);
		return {
			name: (parsed.data.name as string) ?? f.replace(/\.md$/, ""),
			description: (parsed.data.description as string) ?? (parsed.data.when_to_use as string) ?? "",
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

import { readdir, readFile } from "node:fs/promises";

export async function loadSkillRecipes(dataDir: string, role: string): Promise<string> {
	const dir = join(dataDir, "skills", role);
	let files: string[];
	try {
		files = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort();
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return "";
		throw err;
	}
	const parts: string[] = [];
	for (const f of files) {
		const c = await readFile(join(dir, f), "utf8");
		parts.push(c);
	}

	if (role !== "brand-voice-guardian") {
		const commonPath = join(dataDir, "skills", "_common", "brand_voice_instruction.md");
		try {
			const common = await readFile(commonPath, "utf8");
			parts.push(common);
		} catch {
			// _common fájl hiánya nem végzetes
		}
	}

	return parts.join("\n\n---\n\n");
}

export function loadSkillCatalog(dataDir: string, role: string): string {
	const metas = listSkillsForRole(dataDir, role);
	if (metas.length === 0) return "";
	const lines = metas.map(({ name, description }) =>
		`  <skill name="${name}">${description}</skill>`,
	);
	return `<skills>\n${lines.join("\n")}\n</skills>`;
}

export function saveSkill(
	dataDir: string,
	role: string,
	name: string,
	description: string,
	body: string,
): void {
	const dir = join(skillsDir(dataDir), role);
	if (!fsExists(dir)) fsMkdir(dir, { recursive: true });
	const content = matter.stringify(body, { name, description });
	writeFileSync(join(dir, `${name}.md`), content, "utf8");
}

export function deleteSkill(dataDir: string, role: string, name: string): void {
	try {
		unlinkSync(join(skillsDir(dataDir), role, `${name}.md`));
	} catch {
		// already gone — not an error
	}
}

export function loadBrandVoiceInstruction(dataDir: string, role: string): string {
	if (role === "brand-voice-guardian") return "";
	const path = join(dataDir, "skills", "_common", "brand_voice_instruction.md");
	try {
		const raw = readFileSync(path, "utf8");
		return matter(raw).content.trim();
	} catch {
		return "";
	}
}
