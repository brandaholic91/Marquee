import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { Broker } from "../broker/event-bus.js";
import { runMorningBrief } from "./morning-brief.js";
import { chatThreads, messages } from "../db/schema.js";

describe("runMorningBrief", () => {
  let dir: string;
  let db: AgencyDb;
  let close: () => void;
  let broker: Broker;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "morning-brief-test-"));
    const handle = openDb(join(dir, "test.db"));
    db = handle.db;
    close = handle.close;
    broker = new Broker(db);
  });

  afterEach(() => { close(); rmSync(dir, { recursive: true, force: true }); });

  it("creates a consultative chat thread titled Morning Brief", async () => {
    await runMorningBrief(db, dir, broker);
    const threads = db.select().from(chatThreads).all();
    expect(threads).toHaveLength(1);
    expect(threads[0].type).toBe("consultative");
    expect(threads[0].title).toContain("Morning Brief");
  });

  it("inserts a human chat message into the thread", async () => {
    await runMorningBrief(db, dir, broker);
    const msgs = db.select().from(messages).all();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].sender).toBe("human");
    expect(msgs[0].type).toBe("chat");
  });

  it("emits human_message broker event with threadId and text", async () => {
    const emitted: { type: string; payload: Record<string, unknown> }[] = [];
    broker.subscribe((evt) => emitted.push({ type: evt.type, payload: evt.payload }));
    await runMorningBrief(db, dir, broker);
    const event = emitted.find((e) => e.type === "human_message");
    expect(event).toBeDefined();
    expect(event!.payload.threadId).toBeTruthy();
    expect(typeof event!.payload.text).toBe("string");
  });

  it("includes 'Good morning' in the prompt text", async () => {
    const emitted: { type: string; payload: Record<string, unknown> }[] = [];
    broker.subscribe((evt) => emitted.push({ type: evt.type, payload: evt.payload }));
    await runMorningBrief(db, dir, broker);
    const event = emitted.find((e) => e.type === "human_message");
    expect(event!.payload.text as string).toContain("Good morning");
  });
});
