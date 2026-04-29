import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderMemoryContext, applyMemoryTemplate } from "./transform-context.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "marquee-tc-"));
  const target = join(dir, "memory", "clients", "default");
  mkdirSync(target, { recursive: true });
  writeFileSync(
    join(target, "profile.md"),
    `---
business_description: "Foo"
target_audience: ["urban"]
usp: "x"
competitors: ["c1"]
---
profile body`,
  );
  writeFileSync(
    join(target, "brand_voice.md"),
    `---
tone: "barátságos-hozzáértő"
adjectives: ["meleg"]
reference_brands: []
do: ["légy konkrét"]
dont: ["ne használj jargont"]
---
voice body`,
  );
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("renderMemoryContext", () => {
  it("director gets profile + brand_voice + ongoing_campaigns (skip missing)", async () => {
    const out = await renderMemoryContext(dir, "default", "director");
    expect(out).toContain("<memory>");
    expect(out).toContain("memory/profile.md");
    expect(out).toContain("memory/brand_voice.md");
    expect(out).toContain("Foo");
    expect(out).toContain("barátságos-hozzáértő");
    expect(out).not.toContain("ongoing_campaigns.md");
  });

  it("copywriter gets profile + brand_voice only (no ongoing_campaigns)", async () => {
    const out = await renderMemoryContext(dir, "default", "copywriter");
    expect(out).toContain("memory/profile.md");
    expect(out).toContain("memory/brand_voice.md");
    expect(out).not.toContain("ongoing_campaigns");
  });

  it("returns empty string when client has no memory files", async () => {
    const out = await renderMemoryContext(dir, "ghost-client", "director");
    expect(out).toBe("");
  });
});

describe("applyMemoryTemplate", () => {
  it("substitutes mustache references with frontmatter values", async () => {
    const tpl = "Hangnem: {{memory.brand_voice.tone}}, USP: {{memory.profile.usp}}";
    const out = await applyMemoryTemplate(tpl, dir, "default");
    expect(out).toBe("Hangnem: barátságos-hozzáértő, USP: x");
  });

  it("stringifies array values as JSON", async () => {
    const tpl = "Don't: {{memory.brand_voice.dont}}";
    const out = await applyMemoryTemplate(tpl, dir, "default");
    expect(out).toContain('["ne használj jargont"]');
  });

  it("replaces missing keys with empty string", async () => {
    const tpl = "Missing: [{{memory.profile.nonexistent_key}}]";
    const out = await applyMemoryTemplate(tpl, dir, "default");
    expect(out).toBe("Missing: []");
  });

  it("ignores unknown memory file references safely", async () => {
    const tpl = "Unknown: [{{memory.unknown_file.x}}]";
    const out = await applyMemoryTemplate(tpl, dir, "default");
    expect(out).toBe("Unknown: []");
  });

  it("leaves text without mustache references unchanged", async () => {
    const tpl = "no references here";
    const out = await applyMemoryTemplate(tpl, dir, "default");
    expect(out).toBe("no references here");
  });
});
