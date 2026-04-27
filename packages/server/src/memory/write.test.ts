import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeMemoryFile } from "./write.js";

describe("writeMemoryFile", () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-write-"));
		mkdirSync(join(dir, "memory"));
		execSync("git init", { cwd: dir });
		execSync("git config user.email test@test.com", { cwd: dir });
		execSync("git config user.name Test", { cwd: dir });
	});

	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	it("writes a memory file and creates a git commit", async () => {
		await writeMemoryFile(dir, "client_profile", "---\nclient_name: TestCo\n---\n\nbody\n");
		const content = readFileSync(join(dir, "memory/client_profile.md"), "utf8");
		expect(content).toContain("TestCo");
		const log = execSync("git log --oneline", { cwd: dir }).toString();
		expect(log).toContain("memory/client_profile.md");
	});
});
