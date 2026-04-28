import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { Broker } from "../broker/event-bus.js";
import { runMonthlyReview } from "./monthly-review.js";
import { chatThreads, messages } from "../db/schema.js";

describe("runMonthlyReview", () => {
  let dir: string;
  let db: AgencyDb;
  let close: () => void;
  let broker: Broker;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "monthly-review-test-"));
    const handle = openDb(join(dir, "test.db"));
    db = handle.db;
    close = handle.close;
    broker = new Broker(db);
  });

  afterEach(() => { close(); rmSync(dir, { recursive: true, force: true }); });

  it("creates a consultative thread titled Monthly Strategy Review", async () => {
    await runMonthlyReview(db, dir, broker);
    const threads = db.select().from(chatThreads).all();
    expect(threads).toHaveLength(1);
    expect(threads[0].type).toBe("consultative");
    expect(threads[0].title).toContain("Monthly Strategy Review");
  });

  it("inserts a human chat message", async () => {
    await runMonthlyReview(db, dir, broker);
    const msgs = db.select().from(messages).all();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].sender).toBe("human");
    expect(msgs[0].type).toBe("chat");
  });

  it("emits human_message event with threadId and text", async () => {
    const emitted: { type: string; payload: Record<string, unknown> }[] = [];
    broker.subscribe((evt) => emitted.push({ type: evt.type, payload: evt.payload }));
    await runMonthlyReview(db, dir, broker);
    const event = emitted.find((e) => e.type === "human_message");
    expect(event).toBeDefined();
    expect(event!.payload.threadId).toBeTruthy();
  });

  it("includes propose_memory_update instructions in prompt", async () => {
    const emitted: { type: string; payload: Record<string, unknown> }[] = [];
    broker.subscribe((evt) => emitted.push({ type: evt.type, payload: evt.payload }));
    await runMonthlyReview(db, dir, broker);
    const event = emitted.find((e) => e.type === "human_message");
    expect(event!.payload.text as string).toContain("propose_memory_update");
    expect(event!.payload.text as string).toContain("ongoing_campaigns");
  });
});
