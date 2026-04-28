import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadAgentConfig, buildBehaviorBlock } from "./config.js";

describe("loadAgentConfig", () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "config-test-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("returns null when config file does not exist", () => {
    expect(loadAgentConfig(dir, "director")).toBeNull();
  });

  it("parses frontmatter from config.md", () => {
    mkdirSync(join(dir, "agents", "director"), { recursive: true });
    writeFileSync(join(dir, "agents", "director", "config.md"),
      "---\nlanguage: hu\ntone: authoritative\n---\n");
    const config = loadAgentConfig(dir, "director");
    expect(config?.language).toBe("hu");
    expect(config?.tone).toBe("authoritative");
  });
});

describe("buildBehaviorBlock", () => {
  it("returns empty string for empty config", () => {
    expect(buildBehaviorBlock({})).toBe("");
  });

  it("includes all structured fields", () => {
    const block = buildBehaviorBlock({ style: "terse", tone: "authoritative", language: "hu" });
    expect(block).toContain("Style: terse");
    expect(block).toContain("Tone: authoritative");
    expect(block).toContain("Language: hu");
  });

  it("appends system_prompt_override after structured fields", () => {
    const block = buildBehaviorBlock({ language: "hu", system_prompt_override: "Always be concise." });
    expect(block).toContain("Language: hu");
    expect(block).toContain("Always be concise.");
  });

  it("returns just override text when no structured fields", () => {
    const block = buildBehaviorBlock({ system_prompt_override: "Custom instruction." });
    expect(block).toContain("Custom instruction.");
    expect(block).not.toContain("## Behavior");
  });
});
