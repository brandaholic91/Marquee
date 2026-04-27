import { isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { AgencyDb } from "../db/index.js";
import type { Broker } from "../broker/event-bus.js";
import { eventsAfter, recentEvents, approvalsQueue, pipelineCounts, activeAgents } from "../db/queries.js";
import { chatThreads } from "../db/schema.js";

export function registerSseRoute(app: FastifyInstance, opts: { db: AgencyDb; broker: Broker }) {
	app.get("/api/events", (req, reply) => {
		reply.raw.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		});

		const lastIdHeader = req.headers["last-event-id"];
		const lastId = lastIdHeader ? Number.parseInt(String(lastIdHeader), 10) : 0;

		const send = (id: number, type: string, payload: unknown) =>
			reply.raw.write(`id: ${id}\ndata: ${JSON.stringify({ type, ...payload as object })}\n\n`);

		if (lastId > 0) {
			for (const e of eventsAfter(opts.db, lastId)) {
				send(e.id as number, e.type, e.payloadJson ?? {});
			}
		} else {
			for (const e of recentEvents(opts.db, 100).reverse()) {
				send(e.id as number, e.type, e.payloadJson ?? {});
			}
		}

		const heartbeat = setInterval(() => reply.raw.write(": keepalive\n\n"), 15_000);
		const unsub = opts.broker.subscribe((e) => {
			send(e.id, e.type, e.payload);
		});
		req.raw.on("close", () => {
			clearInterval(heartbeat);
			unsub();
		});
	});

	app.get("/api/state/snapshot", async () => ({
		approvals: approvalsQueue(opts.db),
		pipeline: pipelineCounts(opts.db),
		activeAgents: activeAgents(opts.db),
		threads: opts.db.select().from(chatThreads).where(isNull(chatThreads.archivedAt)).all(),
	}));
}
