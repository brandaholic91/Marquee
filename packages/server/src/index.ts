import "dotenv/config";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "./db/index.js";
import { Broker } from "./broker/event-bus.js";
import { recoverState } from "./broker/recovery.js";
import { buildServer } from "./server/index.js";
import { seedClientIfNeeded } from "./memory/seed.js";
import { spawnAgent, type SpawnedAgent } from "./agents/factory.js";
import { messages } from "./db/schema.js";
import { createId } from "@paralleldrive/cuid2";
import { AuthManager } from "./providers/auth.js";

const NAME = process.env.MARQUEE_NAME ?? "marquee";
const dataDir = process.env.DATA_DIR ?? join(homedir(), `.${NAME}`);
const port = Number(process.env.PORT ?? 7892);
const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL ?? null;

/** Adapts the real Broker.emit(type, payload) to the flat { type, ...payload } shape used by route plugins and spawnAgent. */
function makeFlatBroker(broker: Broker): { emit: (e: Record<string, unknown>) => void } {
	return {
		emit(e: Record<string, unknown>) {
			const { type, ...payload } = e;
			broker.emit(String(type), payload as Record<string, unknown>);
		},
	};
}

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

	// 4.5 Start AuthManager (loads ~/.pi/agent/auth.json, refreshes tokens)
	const authFile = process.env.PI_AUTH_FILE ?? join(homedir(), ".pi", "agent", "auth.json");
	const authManager = new AuthManager(authFile);
	await authManager.start();
	console.log(`[marquee] auth loaded from ${authFile}`);

	// 5. Recover from any open sessions left by a previous crash
	recoverState(db);

	// 6. Warm Director chat loop — singleton, lazily spawned on first user chat_message
	let director: SpawnedAgent | null = null;
	let directorThreadId: string | null = null;
	let promptChain: Promise<void> = Promise.resolve();
	const flatBroker = makeFlatBroker(broker);

	broker.subscribe((evt) => {
		if (evt.type !== "chat_message") return;
		const payload = evt.payload as Record<string, unknown>;
		if (payload.sender !== "user") return;
		const text = payload.text;
		const threadId = payload.thread_id;
		if (typeof text !== "string" || !text || typeof threadId !== "string" || !threadId) return;

		// Chain prompts so we never run two agent.prompt() calls concurrently
		promptChain = promptChain
			.then(async () => {
				// Lazy-spawn or re-spawn if threadId changed (e.g. user started a new thread)
				if (!director || directorThreadId !== threadId) {
					director = await spawnAgent({
						db: db as unknown as ReturnType<typeof import("drizzle-orm/better-sqlite3").drizzle>,
						broker: flatBroker,
						dataDir,
						clientSlug: "default",
						role: "director",
						threadId,
						authManager,
					});
					directorThreadId = threadId;
					console.log(
						`[marquee] warm Director spawned (session: ${director.session.id}, thread: ${threadId})`,
					);
				}

				// Prompt the Director; agent.prompt() returns Promise<void>
				// The response text is the last assistant message in state.messages
				await director.agent.prompt(text);

				// Extract the last assistant message text from the transcript
				const agentMessages = director.agent.state.messages;
				let responseText = "";
				for (let i = agentMessages.length - 1; i >= 0; i--) {
					const msg = agentMessages[i] as unknown as Record<string, unknown>;
					if (msg.role === "assistant") {
						const content = msg.content;
						if (typeof content === "string") {
							responseText = content;
						} else if (Array.isArray(content)) {
							responseText = content
								.filter(
									(c): c is { type: "text"; text: string } =>
										typeof c === "object" && c !== null && (c as Record<string, unknown>).type === "text",
								)
								.map((c) => c.text)
								.join("");
						}
						break;
					}
				}

				if (!responseText) {
					// Director used tools but produced no text — don't emit an empty chat_message
					return;
				}

				// Persist the Director's reply
				const replyId = createId();
				const ts = Date.now();
				db.insert(messages)
					.values({
						id: replyId,
						threadId,
						agentSessionId: director.session.id,
						sender: "director",
						type: "chat",
						contentJson: JSON.stringify({ text: responseText }),
						ts,
					})
					.run();

				// Emit chat_message (picked up by SSE → frontend).
				// The sender='director' filter at the top of this handler prevents re-entry.
				broker.emit("chat_message", {
					message_id: replyId,
					thread_id: threadId,
					sender: "director",
					text: responseText,
					ts,
				});
			})
			.catch((err) => {
				console.error("[marquee] Director prompt failed:", err);
				broker.emit("error", {
					source: "director",
					message: err instanceof Error ? err.message : String(err),
				});
				// Director instance stays alive — don't reset to null
			});
	});

	// 7. Build + start the server
	const webRoot = process.env.WEB_ROOT ?? join(here, "..", "..", "web", "dist");
	const app = await buildServer({ db, broker, dataDir, webRoot, n8nWebhookUrl, authManager });

	const shutdown = async () => {
		authManager.stop();
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
