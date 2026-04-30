import { EventEmitter } from "node:events";
import type { AgencyDb } from "../db/index.js";
import { events } from "../db/schema.js";
import { applyCalendarEvent } from "./calendar-state-machine.js";

export interface PersistedEvent {
	id: number;
	ts: number;
	clientSlug: string | null;
	agentSlug: string | null;
	sessionId: string | null;
	turnId: string | null;
	type: string;
	payload: Record<string, unknown>;
}

export interface EmitMeta {
	clientSlug?: string;
	agentSlug?: string;
	sessionId?: string;
	turnId?: string;
}

export class Broker {
	private ee = new EventEmitter();
	constructor(private db: AgencyDb) {
		this.ee.setMaxListeners(0);
	}

		emit(type: string, payload: Record<string, unknown>, meta: EmitMeta = {}): PersistedEvent {
		const ts = Date.now();
		const insert = this.db
			.insert(events)
			.values({
				ts,
				type,
				payloadJson: JSON.stringify(payload) as never,
				clientSlug: meta.clientSlug,
				agentSlug: meta.agentSlug,
				sessionId: meta.sessionId,
				turnId: meta.turnId,
			})
			.returning()
			.get();
		const evt: PersistedEvent = {
			id: insert.id as number,
			ts: insert.ts as number,
			clientSlug: insert.clientSlug ?? null,
			agentSlug: insert.agentSlug ?? null,
			sessionId: insert.sessionId ?? null,
			turnId: insert.turnId ?? null,
			type,
			payload,
		};
		this.ee.emit("event", evt);

		const transition = applyCalendarEvent(this.db, type, payload);
		if (transition) {
			this.emit(
				"calendar_item.status_changed",
				{
					item_id: transition.itemId,
					plan_id: transition.planId,
					prev_status: transition.prevStatus,
					new_status: transition.newStatus,
					brief_id: transition.briefId ?? null,
				},
				meta,
			);
		}
		return evt;
	}

	subscribe(fn: (e: PersistedEvent) => void): () => void {
		this.ee.on("event", fn);
		return () => this.ee.off("event", fn);
	}
}
