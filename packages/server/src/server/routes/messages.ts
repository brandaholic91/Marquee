import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { chatThreads, messages } from "../../db/schema.js";

const ONBOARDING_INSTRUCTIONS = [
	"Onboarding interjút vezetsz egy új ügyfél számára. SZIGORÚ SZABÁLYOK:",
	"- Minden válaszodban pontosan EGY kérdés szerepel, semmi több.",
	"- Soha ne adj kérdéslistát vagy felsorolást.",
	"- Magyarul, tegező formában kommunikálsz végig.",
	"- Ne kommentáld a saját lépéseidet.",
	"",
	"Összegyűjtendő információk (sorrendben, egy kérdéssel egyszerre):",
	"cég neve → ideális ügyfél → fő értékajánlat → brand voice → versenytársak → referencia kiadványok → részletes hangnem",
	"",
	"Ha mindent tudod, hívd meg a propose_memory_update eszközt kétszer:",
	"1. client_profile.md (title, client_name, icp, usp, competitors, brand_voice)",
	"2. brand_guidelines.md (title, tone_of_voice, reference_posts, formatting_rules)",
	"Utána mondd: 'Elkészítettem az ügyfélprofilt és a brand irányelveket jóváhagyásra.'",
].join("\n");

export function registerMessageRoutes(app: FastifyInstance, opts: ServerOpts) {
	app.post<{ Body: { threadId: string; text: string } }>("/api/messages", async (req) => {
		const { threadId, text } = req.body;
		const id = randomUUID();
		opts.db.insert(messages).values({
			id, threadId, sender: "human",
			type: "chat", contentJson: { text } as never,
		}).run();

		// For onboarding threads, prepend instructions to every user message so the
		// director (which starts fresh each turn) always has the interview context.
		const thread = opts.db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).get();
		const agentText = thread?.type === "onboarding"
			? `${ONBOARDING_INSTRUCTIONS}\n\n---\n\nFelhasználó válasza: ${text}`
			: text;

		opts.broker.emit("human_message", { threadId, text: agentText });
		return { id };
	});

	app.post("/api/onboarding/start", async () => {
		const threadId = randomUUID();
		opts.db.insert(chatThreads).values({
			id: threadId, title: "Onboarding", type: "onboarding",
		}).run();

		const GREETING = "Szia! Üdvözöllek a Marquee-nél — én vagyok a csapat Direktorja. Mielőtt belevágnánk az első kampányba, szeretnék megismerni a vállalkozásodat. Mi a céged vagy terméked neve?";

		// Insert greeting directly — no LLM call needed for first message
		const greetingId = randomUUID();
		opts.db.insert(messages).values({
			id: greetingId, threadId, sender: "agent",
			type: "chat", contentJson: { text: GREETING } as never,
		}).run();

		// Emit SSE so the frontend shows the greeting immediately
		opts.broker.emit("agent_message", { threadId, agentSlug: "director", text: GREETING });

		return { threadId };
	});
}
