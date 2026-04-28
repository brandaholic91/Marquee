import { homedir } from "node:os";
import { join } from "node:path";
import { openDb } from "./db/index.js";
import { Broker } from "./broker/event-bus.js";
import { AgentRouter } from "./broker/router.js";
import { recoverState } from "./broker/recovery.js";
import { EvalTrigger } from "./broker/eval-trigger.js";
import { buildServer } from "./server/index.js";
import { seedDefaultSkills } from "./skills/loader.js";
import { seedDefaultMemory } from "./memory/seed.js";
import { seedDefaultAgentIdentities } from "./agents/seed.js";
import { TaskManager } from "./tasks/manager.js";
import { runDailySummary } from "./cron/daily-summary.js";
import { runMorningBrief } from "./cron/morning-brief.js";
import { runWeeklyReport } from "./cron/weekly-report.js";
import { runMonthlyReview } from "./cron/monthly-review.js";
import { CronManager } from "./cron/manager.js";
import { providerMode } from "./providers/index.js";
import { AuthManager } from "./providers/auth.js";
import { Telemetry } from "./telemetry/index.js";

const NAME = process.env.MARQUEE_NAME ?? "marquee";
const dataDir = process.env.DATA_DIR ?? join(homedir(), `.${NAME}`);
const port = Number(process.env.PORT ?? 7892);

async function main() {
	seedDefaultSkills(dataDir);
	await seedDefaultMemory(dataDir);
	seedDefaultAgentIdentities(dataDir);
	const { db, close } = openDb(join(dataDir, "state.db"));
	const webhookUrl = process.env.N8N_WEBHOOK_URL ?? undefined;
	const broker = new Broker(db, webhookUrl);
	const dailyBudgetCents = Number(process.env.MARQUEE_DAILY_BUDGET_CENTS ?? 0);
	const telemetry = new Telemetry(db, { dailyBudgetCents });

	let authManager: AuthManager | undefined;
	if (providerMode() === "openai-subscription") {
		const authFile = process.env.PI_AUTH_FILE
			?? join(homedir(), ".pi", "agent", "auth.json");
		authManager = new AuthManager(authFile);
		await authManager.start();
		console.log("[marquee] openai-subscription mode: auth loaded");
	}

	const router = new AgentRouter(db, broker, dataDir, authManager, telemetry);
	const taskManager = new TaskManager(db, broker, router);
	taskManager.boot();
	router.boot();
	recoverState(db, router);

	const evalTrigger = new EvalTrigger(db, broker, dataDir, authManager);
	evalTrigger.attach();

	const cronManager = new CronManager();
	cronManager.register({
		id: "daily_summary",
		name: "Daily Summary",
		expression: "0 2 * * *",
		description: "Nightly agent activity summary written to memory/daily_notes/",
		enabled: true,
	}, () => runDailySummary(db, dataDir).catch(console.error));
	cronManager.register(
		{
			id: "morning_brief",
			name: "Morning Brief",
			expression: "0 7 * * *",
			description: "Napi ügynökségi briefing a Director chat-en",
			enabled: true,
		},
		() => runMorningBrief(db, dataDir, broker).catch(console.error),
	);
	cronManager.register(
		{
			id: "weekly_report",
			name: "Weekly Performance Report",
			expression: "0 8 * * 1",
			description: "Heti teljesítményjelentés Analytics Analyst-on keresztül",
			enabled: true,
		},
		() => runWeeklyReport(db, dataDir, broker).catch(console.error),
	);
	cronManager.register(
		{
			id: "monthly_review",
			name: "Monthly Strategy Review",
			expression: "0 9 1 * *",
			description: "Havi stratégiai review Director → memory proposals",
			enabled: true,
		},
		() => runMonthlyReview(db, dataDir, broker).catch(console.error),
	);
	cronManager.start();

	const webRoot = process.env.WEB_ROOT ?? join(import.meta.dirname, "../../web/dist");
	const app = await buildServer({ db, broker, router, dataDir, webRoot, cronManager });

	const shutdown = async () => {
		authManager?.stop();
		cronManager.stop();
		await app.close();
		close();
	};
	process.on("SIGTERM", shutdown);
	process.on("SIGINT", shutdown);

	await app.listen({ host: "0.0.0.0", port });
	console.log(`marquee server listening on :${port}`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
