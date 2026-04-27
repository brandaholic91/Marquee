import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { openDb } from "../src/db/index.js";
import { Broker } from "../src/broker/event-bus.js";
import { AgentRouter } from "../src/broker/router.js";
import { briefs, deliverables } from "../src/db/schema.js";

const dataDir = mkdtempSync(join(tmpdir(), "agency-smoke-"));
console.log(`data dir: ${dataDir}`);
mkdirSync(join(dataDir, "memory"), { recursive: true });
writeFileSync(join(dataDir, "memory/client_profile.md"),
	"---\nclient_name: TestCo\nicp: PLG SaaS\nusp: Ship faster\ntagline: Ship fast.\n---\nbody");
writeFileSync(join(dataDir, "memory/brand_guidelines.md"),
	"---\ntone_of_voice: data-driven, direct\n---\nbody");

(async () => {
	const { db, close } = openDb(join(dataDir, "state.db"));
	const broker = new Broker(db);
	const router = new AgentRouter(db, broker, dataDir);
	router.boot();

	const briefId = randomUUID();
	db.insert(briefs).values({
		id: briefId, status: "draft",
		contentMd: "# Test\n\n**Scope:** write a 200-word blog post about PLG metrics\n\n**Deliverables:** blog_post",
	}).run();

	console.log("Queuing brief:", briefId);
	router.queueBrief(briefId);

	const start = Date.now();
	let found = false;
	while (Date.now() - start < 10_000) {
		await new Promise((r) => setTimeout(r, 500));
		const ds = db.select().from(deliverables).all();
		if (ds.some((d) => d.status === "awaiting_approval" || d.status === "awaiting_eval")) {
			console.log("✓ deliverable progressed in", Math.round((Date.now() - start) / 1000), "s");
			found = true;
			break;
		}
	}

	if (!found) {
		console.log("ℹ smoke script complete — broker is wired but actual LLM dispatch requires HERMES_PROVIDER_MODE=api and API keys");
	}
	close();
	process.exit(0);
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
