import type { FastifyInstance } from "fastify";
import type { AgencyDb } from "../db/index.js";
import type { Broker } from "../broker/event-bus.js";
import { eventsAfter, recentEvents } from "../db/queries.js";

export function registerSseRoute(app: FastifyInstance, opts: { db: AgencyDb; broker: Broker }) {
	app.get("/api/events", (req, reply) => {
		reply.raw.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		});

		const lastIdHeader = req.headers["last-event-id"];
		const lastId = lastIdHeader ? Number.parseInt(String(lastIdHeader), 10) : 0;

		const sendRaw = (id: number, type: string, payload: unknown) =>
			reply.raw.write(`id: ${id}\ndata: ${JSON.stringify({ type, ...(payload as object) })}\n\n`);

		if (lastId > 0) {
			for (const e of eventsAfter(opts.db, lastId)) {
				const payload =
					typeof e.payloadJson === "string" ? JSON.parse(e.payloadJson) : (e.payloadJson ?? {});
				sendRaw(e.id as number, e.type, payload);
			}
		} else {
			for (const e of recentEvents(opts.db, 100).reverse()) {
				const payload =
					typeof e.payloadJson === "string" ? JSON.parse(e.payloadJson) : (e.payloadJson ?? {});
				sendRaw(e.id as number, e.type, payload);
			}
		}

		const heartbeat = setInterval(() => reply.raw.write(": keepalive\n\n"), 15_000);
		const unsub = opts.broker.subscribe((e) => {
			sendRaw(e.id, e.type, e.payload);
		});
		req.raw.on("close", () => {
			clearInterval(heartbeat);
			unsub();
		});
	});
}
