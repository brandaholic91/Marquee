import { eq } from "drizzle-orm";
import { existsSync, mkdirSync, readdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
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
		async (req, reply) => {
			const { id } = req.params;
			const decision = req.body?.decision;
			if (decision !== "approved" && decision !== "rejected") {
				return reply.code(400).send({ error: "decision must be 'approved' or 'rejected'" });
			}

			const proposal = opts.db.select().from(memoryProposals).where(eq(memoryProposals.id, id)).get();
			if (!proposal) return reply.code(404).send({ error: "not found" });

			if (decision === "rejected") {
				opts.db.update(memoryProposals).set({ status: "rejected" }).where(eq(memoryProposals.id, id)).run();
				opts.broker.emit("memory_proposal_decided", { proposalId: id, decision: "rejected" });
				return { ok: true };
			}

			const git = simpleGit(opts.dataDir);
			const patchPath = join(tmpdir(), `marquee-patch-${id}.diff`);
			try {
				writeFileSync(patchPath, proposal.patch, "utf8");
				await git.raw(["apply", "--check", patchPath]);
			} catch (err) {
				try { unlinkSync(patchPath); } catch { /* ignore */ }
				return reply.code(409).send({
					error: "patch_conflict",
					detail: err instanceof Error ? err.message : String(err),
				});
			}

			try {
				await git.raw(["apply", patchPath]);
				await git.add(join(opts.dataDir, "memory", proposal.file));
				await git.commit(`memory: apply agent proposal for ${proposal.file}`);
			} catch (err) {
				try { unlinkSync(patchPath); } catch { /* ignore */ }
				try { await git.checkout([join(opts.dataDir, "memory", proposal.file)]); } catch { /* ignore */ }
				return reply.code(500).send({ error: "git_apply_failed" });
			}

			try { unlinkSync(patchPath); } catch { /* ignore */ }

			opts.db.update(memoryProposals).set({ status: "approved" }).where(eq(memoryProposals.id, id)).run();
			opts.broker.emit("memory_proposal_decided", { proposalId: id, decision: "approved" });
			opts.broker.emit("memory_updated", { file: proposal.file, by: "agent" });
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
				const isRepo = await git.checkIsRepo().catch(() => false);
				if (isRepo) {
					await git.add(filePath);
					await git.commit(`memory: update ${name}.md`, [filePath]);
				}
			} catch {
				try { await simpleGit(opts.dataDir).checkout([filePath]); } catch { /* best effort */ }
				return reply.code(500).send({ error: "git commit failed, change reverted" });
			}
			opts.broker.emit("memory_updated", { file: `${name}.md`, by: "human" });
			return { ok: true };
		},
	);

	// create new memory file
	app.post<{ Body: { filename: string } }>("/api/memory", async (req, reply) => {
		const { filename } = req.body;
		if (!filename || filename.includes("..") || filename.includes("/")) {
			return reply.code(400).send({ error: "invalid filename" });
		}
		const name = filename.endsWith(".md") ? filename : `${filename}.md`;
		const dir = memDir();
		if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
		const filePath = join(dir, name);
		if (existsSync(filePath)) return reply.code(409).send({ error: "file already exists" });
		const starter = `---\ntitle: ${name.replace(/\.md$/, "")}\n---\n`;
		writeFileSync(filePath, starter, "utf8");
		try {
			const git = simpleGit(opts.dataDir);
			const isRepo = await git.checkIsRepo().catch(() => false);
			if (isRepo) {
				await git.add(filePath);
				await git.commit(`memory: create ${name}`, [filePath]);
			}
		} catch { /* best effort */ }
		opts.broker.emit("memory_created", { file: name });
		return reply.code(201).send({ ok: true, filename: name });
	});
}
