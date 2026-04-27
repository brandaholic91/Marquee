import { homedir } from "node:os";
import { join } from "node:path";
import { openDb } from "./db/index.js";
import { Broker } from "./broker/event-bus.js";
import { AgentRouter } from "./broker/router.js";
import { recoverState } from "./broker/recovery.js";
import { EvalTrigger } from "./broker/eval-trigger.js";
import { buildServer } from "./server/index.js";
import { seedDefaultSkills } from "./skills/loader.js";

const NAME = process.env.MARQUEE_NAME ?? "marquee";
const dataDir = process.env.DATA_DIR ?? join(homedir(), `.${NAME}`);
const port = Number(process.env.PORT ?? 7892);

seedDefaultSkills(dataDir);

async function main() {
	const { db, close } = openDb(join(dataDir, "state.db"));
	const webhookUrl = process.env.N8N_WEBHOOK_URL ?? undefined;
	const broker = new Broker(db, webhookUrl);
	const router = new AgentRouter(db, broker, dataDir);
	router.boot();
	recoverState(db, router);

	const evalTrigger = new EvalTrigger(db, broker, dataDir);
	evalTrigger.attach();

	const webRoot = process.env.WEB_ROOT ?? join(import.meta.dirname, "../../web/dist");
	const app = await buildServer({ db, broker, router, dataDir, webRoot });

	process.on("SIGTERM", async () => {
		await app.close();
		close();
	});

	await app.listen({ host: "0.0.0.0", port });
	console.log(`marquee server listening on :${port}`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
