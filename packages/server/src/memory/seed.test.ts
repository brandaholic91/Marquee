import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { simpleGit } from "simple-git";
import { describe, it, expect, afterEach } from "vitest";
import { seedDefaultMemory } from "./seed.js";

describe("seedDefaultMemory", () => {
  let dir: string;
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  async function makeGitDir() {
    dir = mkdtempSync(join(tmpdir(), "seed-test-"));
    const git = simpleGit(dir);
    await git.init();
    await git.addConfig("user.name", "test");
    await git.addConfig("user.email", "test@test.com");
    return dir;
  }

  it("creates 4 template files when memory dir is empty", async () => {
    const d = await makeGitDir();
    await seedDefaultMemory(d);
    for (const name of ["client_profile.md", "brand_guidelines.md", "ongoing_campaigns.md", "content_history.md"]) {
      expect(existsSync(join(d, "memory", name))).toBe(true);
      const content = readFileSync(join(d, "memory", name), "utf8");
      expect(content).toContain("---");
    }
  });

  it("does not overwrite existing files", async () => {
    const d = await makeGitDir();
    await seedDefaultMemory(d);
    const before = readFileSync(join(d, "memory", "client_profile.md"), "utf8");
    await seedDefaultMemory(d);
    const after = readFileSync(join(d, "memory", "client_profile.md"), "utf8");
    expect(after).toBe(before);
  });

  it("skips git commit when dataDir is not a repo", async () => {
    dir = mkdtempSync(join(tmpdir(), "seed-test-nogit-"));
    await expect(seedDefaultMemory(dir)).resolves.not.toThrow();
  });
});
