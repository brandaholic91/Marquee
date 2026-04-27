import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { messages } from "../../db/schema.js";

export function registerMessageRoutes(app: FastifyInstance, opts: ServerOpts) {
	app.post<{ Body: { threadId: string; text: string } }>("/api/messages", async (req) => {
		const id = randomUUID();
		opts.db.insert(messages).values({
			id, threadId: req.body.threadId, sender: "human",
			type: "chat", contentJson: { text: req.body.text } as never,
		}).run();
		opts.broker.emit("human_message", { threadId: req.body.threadId, text: req.body.text });
		return { id };
	});
}
