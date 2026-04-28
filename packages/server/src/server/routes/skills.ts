import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";

const ALL_ROLES = [
	"director", "content-lead", "distribution-lead", "insights-lead",
	"copywriter", "social-manager", "seo-analyst", "eval-judge",
];

interface SkillInfo {
	slug: string;
	name: string;
	agents: string[];
	content: string;
}

function roleDir(dataDir: string, role: string) {
	return join(dataDir, "skills", role);
}

function getAllSkills(dataDir: string): SkillInfo[] {
	const map = new Map<string, SkillInfo>();
	for (const role of ALL_ROLES) {
		const dir = roleDir(dataDir, role);
		if (!existsSync(dir)) continue;
		for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
			const slug = file.replace(/\.md$/, "");
			const content = readFileSync(join(dir, file), "utf8");
			const name = (matter(content).data.name as string | undefined) ?? slug;
			const existing = map.get(slug);
			if (existing) {
				existing.agents.push(role);
			} else {
				map.set(slug, { slug, name, agents: [role], content });
			}
		}
	}
	return [...map.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

const VALID_SLUG = /^[a-z0-9_-]+$/;

export function registerSkillRoutes(app: FastifyInstance, opts: ServerOpts) {
	app.get("/api/skills", async () => getAllSkills(opts.dataDir));

	app.get<{ Params: { slug: string } }>("/api/skills/:slug", async (req, reply) => {
		const skill = getAllSkills(opts.dataDir).find((s) => s.slug === req.params.slug);
		if (!skill) return reply.code(404).send({ error: "not found" });
		return skill;
	});

	app.post<{ Body: { slug: string; content: string; agents: string[] } }>("/api/skills", async (req, reply) => {
		const { slug, content, agents } = req.body;
		if (!slug || !content || !agents?.length) return reply.code(400).send({ error: "slug, content and agents required" });
		if (!VALID_SLUG.test(slug)) return reply.code(400).send({ error: "slug must be lowercase a-z 0-9 _ -" });
		for (const role of agents.filter((r) => ALL_ROLES.includes(r))) {
			const dir = roleDir(opts.dataDir, role);
			mkdirSync(dir, { recursive: true });
			writeFileSync(join(dir, `${slug}.md`), content, "utf8");
		}
		return { ok: true };
	});

	app.put<{ Params: { slug: string }; Body: { content?: string; agents?: string[] } }>("/api/skills/:slug", async (req, reply) => {
		const { slug } = req.params;
		if (!VALID_SLUG.test(slug)) return reply.code(400).send({ error: "invalid slug" });
		const { content, agents } = req.body;

		if (agents !== undefined) {
			for (const role of ALL_ROLES) {
				const path = join(roleDir(opts.dataDir, role), `${slug}.md`);
				if (agents.includes(role)) {
					mkdirSync(roleDir(opts.dataDir, role), { recursive: true });
					const body = content ?? (existsSync(path) ? readFileSync(path, "utf8") : `---\nname: ${slug}\n---\n`);
					writeFileSync(path, body, "utf8");
				} else if (existsSync(path)) {
					rmSync(path);
				}
			}
		} else if (content !== undefined) {
			for (const role of ALL_ROLES) {
				const path = join(roleDir(opts.dataDir, role), `${slug}.md`);
				if (existsSync(path)) writeFileSync(path, content, "utf8");
			}
		}
		return { ok: true };
	});

	app.delete<{ Params: { slug: string } }>("/api/skills/:slug", async (req) => {
		for (const role of ALL_ROLES) {
			const path = join(roleDir(opts.dataDir, role), `${req.params.slug}.md`);
			if (existsSync(path)) rmSync(path);
		}
		return { ok: true };
	});
}
