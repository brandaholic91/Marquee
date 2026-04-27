import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { events } from "../db/schema.js";
import { Broker } from "./event-bus.js";

describe("Broker", () => {
	let dir: string;
	let db: AgencyDb;
	let close: () => void;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-broker-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
	});

	afterEach(() => {
		close();
		rmSync(dir, { recursive: true, force: true });
	});

	it("persists emitted events and notifies subscribers", () => {
		const b = new Broker(db);
		const received: unknown[] = [];
		b.subscribe((e) => received.push(e));
		b.emit("delegation_created", { delegationId: "abc" }, { agentSlug: "director" });
		const rows = db.select().from(events).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].type).toBe("delegation_created");
		expect(received).toHaveLength(1);
	});
});
