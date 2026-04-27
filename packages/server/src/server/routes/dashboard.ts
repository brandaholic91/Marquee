import type { FastifyInstance } from "fastify";

export function registerHealthRoute(app: FastifyInstance) {
	app.get("/api/health", async () => ({ name: "marquee", version: "0.1.0", ok: true }));
}
