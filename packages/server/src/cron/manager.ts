import { schedule, type ScheduledTask } from "node-cron";

export interface CronJobDef {
	id: string;
	name: string;
	expression: string;   // standard 5-field cron: "0 2 * * *"
	description: string;
	enabled: boolean;
	lastRun?: Date;
}

export class CronManager {
	private jobs = new Map<string, { def: CronJobDef; task?: ScheduledTask; fn: () => void }>();

	register(def: CronJobDef, fn: () => void): void {
		this.jobs.set(def.id, { def, fn });
	}

	start(): void {
		for (const [, entry] of this.jobs) {
			if (!entry.def.enabled) continue;
			entry.task = schedule(entry.def.expression, () => {
				entry.def.lastRun = new Date();
				entry.fn();
			});
		}
	}

	stop(): void {
		for (const [, entry] of this.jobs) {
			entry.task?.stop();
		}
	}

	list(): CronJobDef[] {
		return [...this.jobs.values()].map((e) => ({ ...e.def }));
	}
}
