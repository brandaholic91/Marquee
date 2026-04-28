import Fastify from "fastify";
import type { AgencyDb } from "../db/index.js";
import type { Broker } from "../broker/event-bus.js";
import type { AgentRouter } from "../broker/router.js";
import { registerBriefRoutes } from "./routes/briefs.js";
import { registerMessageRoutes } from "./routes/messages.js";
import { registerApprovalRoutes } from "./routes/approvals.js";
import { registerMemoryRoutes } from "./routes/memory.js";
import { registerDeliverableRoutes } from "./routes/deliverables.js";
import { registerThreadRoutes } from "./routes/threads.js";
import { registerHealthRoute } from "./routes/dashboard.js";
import { registerTaskRoutes } from "./routes/tasks.js";
import { registerAgentRoutes } from "./routes/agents.js";
import { registerSseRoute } from "./sse.js";

export interface ServerOpts {
	db: AgencyDb;
	broker: Broker;
	router: AgentRouter;
	dataDir: string;
	webRoot: string;
}

export async function buildServer(opts: ServerOpts) {
	const app = Fastify({ logger: false });
	// Serve static files only in production (webRoot might not exist in tests)
	try {
		const { default: fastifyStatic } = await import("@fastify/static");
		await app.register(fastifyStatic, { root: opts.webRoot, prefix: "/", wildcard: true, decorateReply: false });
	} catch {
		// ignore if webRoot doesn't exist in test environment
	}

	// API token auth guard for write endpoints
	const apiToken = process.env.MARQUEE_API_TOKEN;
	if (apiToken) {
		app.addHook("preHandler", async (req, reply) => {
			const writeMethods = ["POST", "PUT", "PATCH", "DELETE"];
			if (!writeMethods.includes(req.method)) return;
			if (!req.url.startsWith("/api/")) return;
			const auth = req.headers.authorization;
			if (!auth || auth !== `Bearer ${apiToken}`) {
				return reply.code(401).send({ error: "Unauthorized" });
			}
		});
	}

	registerHealthRoute(app);
	registerThreadRoutes(app, opts);
	registerBriefRoutes(app, opts);
	registerMessageRoutes(app, opts);
	registerApprovalRoutes(app, opts);
	registerDeliverableRoutes(app, opts);
	registerMemoryRoutes(app, opts);
	registerTaskRoutes(app, opts);
	registerAgentRoutes(app, opts);
	registerSseRoute(app, opts);
	return app;
}
