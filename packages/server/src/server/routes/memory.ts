import { eq } from "drizzle-orm";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { simpleGit } from "simple-git";
import matter from "gray-matter";
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { memoryProposals } from "../../db/schema.js";
import { readMemoryFile } from "../../memory/read.js";

export function registerMemoryRoutes(app: FastifyInstance, opts: ServerOpts) {
	const memDir = () => join(opts.dataDir, "memory");

	// existing proposal endpoints — unchanged
	app.get("/api/memory-proposals", async () =>
		opts.db.select().from(memoryProposals).all(),
	);

	app.post<{ Params: { id: string }; Body: { decision: "approved" | "rejected" } }>(
		"/api/memory-proposals/:id/approve",
		async (req) => {
			const { id } = req.params;
			const decision = req.body?.decision ?? "approved";
			opts.db.update(memoryProposals)
				.set({ status: decision === "approved" ? "approved" : "rejected" })
				.where(eq(memoryProposals.id, id))
				.run();
			opts.broker.emit("memory_proposal_decided", { proposalId: id, decision });
			return { ok: true };
		},
	);

	// list memory files
	app.get("/api/memory/files", async () => {
		const dir = memDir();
		if (!existsSync(dir)) return [];
		return readdirSync(dir)
			.filter((f) => f.endsWith(".md"))
			.map((name) => ({ name }));
	});

	// read a memory file
	app.get<{ Params: { filename: string } }>("/api/memory/:filename", async (req, reply) => {
		const name = req.params.filename.replace(/\.md$/, "");
		const path = join(memDir(), `${name}.md`);
		if (!existsSync(path)) return reply.code(404).send({ error: "not found" });
		return readMemoryFile(opts.dataDir, name);
	});

	// write a memory file (inline editor)
	app.put<{ Params: { filename: string }; Body: { content: string } }>(
		"/api/memory/:filename",
		async (req, reply) => {
			const name = req.params.filename.replace(/\.md$/, "");
			const { content } = req.body;
			// require YAML frontmatter
			const parsed = matter(content);
			if (Object.keys(parsed.data).length === 0) {
				return reply.code(400).send({ error: "content must have YAML frontmatter" });
			}
			const dir = memDir();
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}
			const filePath = join(dir, `${name}.md`);
			writeFileSync(filePath, content, "utf8");
			try {
				const git = simpleGit(opts.dataDir);
				await git.add(filePath);
				await git.commit(`memory: update ${name}.md`, [filePath]);
			} catch {
				// git not initialised in test env — ignore
			}
			opts.broker.emit("memory_updated", { file: `${name}.md`, by: "human" });
			return { ok: true };
		},
	);
}
