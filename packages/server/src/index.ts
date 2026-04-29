import "dotenv/config";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "./db/index.js";
import { Broker } from "./broker/event-bus.js";
import { recoverState } from "./broker/recovery.js";
import { buildServer } from "./server/index.js";
import { seedClientIfNeeded } from "./memory/seed.js";

const NAME = process.env.MARQUEE_NAME ?? "marquee";
const dataDir = process.env.DATA_DIR ?? join(homedir(), `.${NAME}`);
const port = Number(process.env.PORT ?? 7892);
const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL ?? null;

// TODO(v2): POST /api/messages doesn't prompt the warm Director directly;
// that wiring belongs here once the Director lifecycle is added. For v1,
// chat messages are persisted and `chat_message` events are emitted, but
// the Director is not triggered automatically.

async function main() {
	// 1. Seed memory + skills from packaged seed/ on first run
	const here = dirname(fileURLToPath(import.meta.url));
	// Seed dir is at packages/server/seed/ — relative to this file:
	//   dev  (src/index.ts):  ../seed
	//   prod (dist/index.js): ../seed  (assuming dist sits next to seed)
	const seedDir = join(here, "..", "seed");
	await seedClientIfNeeded(dataDir, seedDir, "default");

	// 2. Open DB (auto-migrates on connect)
	const { db, close } = openDb(join(dataDir, "state.db"));

	// 3. Ensure 'default' client row exists (FK target for everything)
	const { clients } = await import("./db/schema.js");
	const { eq } = await import("drizzle-orm");
	const existing = db.select().from(clients).where(eq(clients.slug, "default")).all();
	if (existing.length === 0) {
		db.insert(clients).values({ slug: "default", name: "Default", createdAt: Date.now() }).run();
	}

	// 4. Create the broker
	const broker = new Broker(db);

	// 5. Recover from any open sessions left by a previous crash
	recoverState(db, broker);

	// 6. Build + start the server
	const webRoot = process.env.WEB_ROOT ?? join(here, "..", "..", "web", "dist");
	const app = await buildServer({ db, broker, dataDir, webRoot, n8nWebhookUrl });

	const shutdown = async () => {
		await app.close();
		close();
		process.exit(0);
	};
	process.on("SIGTERM", shutdown);
	process.on("SIGINT", shutdown);

	await app.listen({ host: "0.0.0.0", port });
	console.log(`marquee server listening on :${port}`);
	if (n8nWebhookUrl) console.log(`n8n webhook configured: ${n8nWebhookUrl}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
