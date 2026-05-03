import Fastify from "fastify";
import type { AgencyDb } from "../db/index.js";
import type { Broker } from "../broker/event-bus.js";
import { briefsRoutes } from "./routes/briefs.js";
import { messagesRoutes } from "./routes/messages.js";
import { threadsRoutes } from "./routes/threads.js";
import { campaignsRoutes } from "./routes/campaigns.js";
import { deliverablesRoutes } from "./routes/deliverables.js";
import { memoryRoutes } from "./routes/memory.js";
import { agentsRoutes } from "./routes/agents.js";
import { plansRoutes } from "./routes/plans.js";
import { calendarsRoutes } from "./routes/calendars.js";
import { wikiRoutes } from "./routes/wiki.js";
import { authMiddleware } from "./auth-middleware.js";
import { registerSseRoute } from "./sse.js";
import { AuthManager } from "../providers/auth.js";

export interface ServerOpts {
	db: AgencyDb;
	broker: Broker;
	dataDir: string;
	webRoot: string;
	n8nWebhookUrl: string | null;
	authManager: AuthManager;
}

/**
 * The route plugins use a local `interface Broker { emit(e: Record<string,unknown>): void }`
 * with a flat object signature, while the real Broker.emit(type, payload, meta) takes separate
 * args. This shim adapts the flat-object style to the real Broker.
 */
function makeFlatBroker(broker: Broker): { emit: (e: Record<string, unknown>) => void } {
	return {
		emit(e: Record<string, unknown>) {
			const { type, ...payload } = e;
			broker.emit(String(type), payload as Record<string, unknown>);
		},
	};
}

export async function buildServer(opts: ServerOpts) {
	const app = Fastify({ logger: false });

	// Static assets — only in production
	try {
		const { default: fastifyStatic } = await import("@fastify/static");
		await app.register(fastifyStatic, {
			root: opts.webRoot,
			prefix: "/",
			wildcard: true,
			decorateReply: false,
		});
	} catch {
		// ok in tests or if webRoot doesn't exist
	}

	// Bearer-token auth (no-op if MARQUEE_API_TOKEN unset)
	await app.register(authMiddleware);

	const flatBroker = makeFlatBroker(opts.broker);
	const db = opts.db as unknown as ReturnType<typeof import("drizzle-orm/better-sqlite3").drizzle>;

	// API plugins
	await app.register(briefsRoutes, { db, broker: flatBroker, dataDir: opts.dataDir, authManager: opts.authManager });
	await app.register(messagesRoutes, { db, broker: flatBroker });
	await app.register(threadsRoutes, { db });
	await app.register(campaignsRoutes, { db });
	await app.register(deliverablesRoutes, {
		db,
		broker: flatBroker,
		dataDir: opts.dataDir,
		n8nWebhookUrl: opts.n8nWebhookUrl,
		authManager: opts.authManager,
	});
	await app.register(memoryRoutes, { db, dataDir: opts.dataDir });
	await app.register(plansRoutes, { db, broker: flatBroker });
	await app.register(calendarsRoutes, { db });
	await app.register(agentsRoutes, { dataDir: opts.dataDir });
	await app.register(wikiRoutes, { db, dataDir: opts.dataDir });

	// SSE (uses typed AgencyDb + Broker directly)
	registerSseRoute(app, { db: opts.db, broker: opts.broker });

	// Health check
	app.get("/api/health", async () => ({ ok: true }));

	return app;
}
