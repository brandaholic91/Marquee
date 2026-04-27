import { EventEmitter } from "node:events";
import type { AgencyDb } from "../db/index.js";
import { events } from "../db/schema.js";

export interface PersistedEvent {
	id: number;
	ts: Date;
	agentSlug: string | null;
	sessionId: string | null;
	turnId: string | null;
	type: string;
	payload: Record<string, unknown>;
}

export interface EmitMeta {
	agentSlug?: string;
	sessionId?: string;
	turnId?: string;
}

export class Broker {
	private ee = new EventEmitter();
	constructor(
		private db: AgencyDb,
		private webhookUrl?: string,
	) {
		this.ee.setMaxListeners(0);
	}

	emit(type: string, payload: Record<string, unknown>, meta: EmitMeta = {}): PersistedEvent {
		const insert = this.db
			.insert(events)
			.values({
				type, payloadJson: payload as never,
				agentSlug: meta.agentSlug, sessionId: meta.sessionId, turnId: meta.turnId,
			})
			.returning()
			.get();
		const evt: PersistedEvent = {
			id: insert.id as number,
			ts: insert.ts as Date,
			agentSlug: insert.agentSlug ?? null,
			sessionId: insert.sessionId ?? null,
			turnId: insert.turnId ?? null,
			type,
			payload,
		};
		this.ee.emit("event", evt);
		if (this.webhookUrl) {
			// fire-and-forget, never throws
			fetch(this.webhookUrl, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(evt),
			}).catch(() => {});
		}
		return evt;
	}

	subscribe(fn: (e: PersistedEvent) => void): () => void {
		this.ee.on("event", fn);
		return () => this.ee.off("event", fn);
	}
}
