import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { chatThreads, messages } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export function registerThreadRoutes(app: FastifyInstance, opts: ServerOpts) {
	app.get("/api/threads", async () => opts.db.select().from(chatThreads).all());

	app.post<{ Body: { title: string; type?: string } }>("/api/threads", async (req) => {
		const id = randomUUID();
		opts.db.insert(chatThreads).values({
			id, title: req.body.title,
			type: (req.body.type as "intake" | "dispatched" | "consultative") ?? "intake",
		}).run();
		return { id };
	});

	app.get<{ Params: { id: string } }>("/api/threads/:id", async (req) =>
		opts.db.select().from(chatThreads).where(eq(chatThreads.id, req.params.id)).get() ?? null,
	);

	app.get<{ Params: { id: string } }>("/api/threads/:id/messages", async (req) =>
		opts.db.select().from(messages).where(eq(messages.threadId, req.params.id)).all(),
	);

	app.patch<{ Params: { id: string }; Body: { title: string } }>("/api/threads/:id", async (req, reply) => {
		const { title } = req.body;
		if (!title?.trim()) return reply.code(400).send({ error: "title required" });
		opts.db.update(chatThreads).set({ title: title.trim() }).where(eq(chatThreads.id, req.params.id)).run();
		return { ok: true };
	});

	app.delete<{ Params: { id: string } }>("/api/threads/:id", async (req) => {
		opts.db.update(chatThreads).set({ archivedAt: new Date() }).where(eq(chatThreads.id, req.params.id)).run();
		return { ok: true };
	});
}
