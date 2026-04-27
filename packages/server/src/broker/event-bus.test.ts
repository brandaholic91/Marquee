import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("Broker webhook dispatch", () => {
	let dir: string;
	let close: () => void;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "broker-test-"));
		const res = openDb(join(dir, "test.db"));
		close = res.close;
	});
	afterEach(() => { close(); rmSync(dir, { recursive: true, force: true }); });

	it("calls fetch with event payload when webhookUrl is set", async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal("fetch", fetchMock);

		const { db } = openDb(join(dir, "test2.db"));
		const broker = new Broker(db, "http://n8n.test/webhook/abc");
		broker.emit("deliverable_shipped", { deliverableId: "d-1" });

		await new Promise((r) => setTimeout(r, 20));
		expect(fetchMock).toHaveBeenCalledWith(
			"http://n8n.test/webhook/abc",
			expect.objectContaining({ method: "POST" }),
		);
		vi.unstubAllGlobals();
	});

	it("does not call fetch when webhookUrl is not set", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const { db } = openDb(join(dir, "test3.db"));
		const broker = new Broker(db);
		broker.emit("deliverable_shipped", { deliverableId: "d-1" });

		await new Promise((r) => setTimeout(r, 20));
		expect(fetchMock).not.toHaveBeenCalled();
		vi.unstubAllGlobals();
	});
});
