import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeTransformContext } from "./transform-context.js";
import type { StandardMessage } from "./messages.js";

describe("transformContext", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "agency-tc-"));
    mkdirSync(join(dir, "memory"));
    writeFileSync(
      join(dir, "memory/client_profile.md"),
      "---\nclient_name: Stackly\nbrand_voice: tight\n---\n\nbody\n",
    );
    writeFileSync(join(dir, "memory/brand_guidelines.md"), "---\ntone_of_voice: data-driven\n---\nx");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("prepends memory block as first user message", async () => {
    const tc = makeTransformContext({ dataDir: dir, role: "copywriter", keepRecent: 50 });
    const out = await tc([{ role: "user", content: "hi" }]);
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out[0].role).toBe("user");
    expect(out[0].content).toContain("Stackly");
    expect(out[0].content).toContain("data-driven");
  });

  it("preserves all old messages outside keepRecent window (no messages omitted)", async () => {
    const tc = makeTransformContext({ dataDir: dir, role: "copywriter", keepRecent: 5 });
    const many = Array.from({ length: 20 }, (_, i) => ({ role: "user" as const, content: `m${i}` }));
    const out = await tc(many);
    // 1 memory + 15 old (preserved) + 5 recent = 21
    expect(out.length).toBe(21);
    expect(out.some((m) => "content" in m && m.content === "m0")).toBe(true);
    expect(out.some((m) => "content" in m && m.content.includes("[earlier turns summarized"))).toBe(false);
  });

  it("compresses prefixed web_fetch result outside window to 1-line summary", async () => {
    const tc = makeTransformContext({ dataDir: dir, role: "copywriter", keepRecent: 3 });
    const messages: StandardMessage[] = [
      { role: "assistant", content: "fetching..." },
      { role: "tool", toolCallId: "c1", content: "[tool:web_fetch]\n" + "long html content ".repeat(200) },
      { role: "user", content: "r1" },
      { role: "user", content: "r2" },
      { role: "user", content: "r3" },
    ];
    const out = await tc(messages);
    const toolMsg = out.find((m) => m.role === "tool");
    expect(toolMsg?.content).toBe("[tool:web_fetch → content fetched]");
  });

  it("compresses delegate_to_lead result outside window", async () => {
    const tc = makeTransformContext({ dataDir: dir, role: "director", keepRecent: 2 });
    const messages: StandardMessage[] = [
      { role: "tool", toolCallId: "c1", content: '[tool:delegate_to_lead]\n{"delegationId":"abc-123"}' },
      { role: "user", content: "r1" },
      { role: "user", content: "r2" },
    ];
    const out = await tc(messages);
    const toolMsg = out.find((m) => m.role === "tool");
    expect(toolMsg?.content).toBe("[tool:delegate_to_lead → delegated (id: abc-123)]");
  });

  it("leaves prefixed tool result inside recent window unchanged", async () => {
    const tc = makeTransformContext({ dataDir: dir, role: "copywriter", keepRecent: 5 });
    const fullContent = "[tool:web_fetch]\n" + "x".repeat(3000);
    const messages: StandardMessage[] = [
      { role: "user", content: "old1" },
      { role: "tool", toolCallId: "c1", content: fullContent },
      { role: "user", content: "r1" },
      { role: "user", content: "r2" },
      { role: "user", content: "r3" },
    ];
    const out = await tc(messages);
    const toolMsg = out.find((m) => m.role === "tool");
    expect(toolMsg?.content).toBe(fullContent);
  });

  it("leaves read_memory tool result unchanged even outside window", async () => {
    const tc = makeTransformContext({ dataDir: dir, role: "copywriter", keepRecent: 2 });
    const memContent = "[tool:read_memory]\n{\"body\": \"important context\"}";
    const messages: StandardMessage[] = [
      { role: "tool", toolCallId: "c1", content: memContent },
      { role: "user", content: "r1" },
      { role: "user", content: "r2" },
    ];
    const out = await tc(messages);
    const toolMsg = out.find((m) => m.role === "tool");
    expect(toolMsg?.content).toBe(memContent);
  });

  it("leaves tool result with no prefix unchanged", async () => {
    const tc = makeTransformContext({ dataDir: dir, role: "copywriter", keepRecent: 2 });
    const legacyContent = '{"ok":true}';
    const messages: StandardMessage[] = [
      { role: "tool", toolCallId: "c1", content: legacyContent },
      { role: "user", content: "r1" },
      { role: "user", content: "r2" },
    ];
    const out = await tc(messages);
    const toolMsg = out.find((m) => m.role === "tool");
    expect(toolMsg?.content).toBe(legacyContent);
  });
});
