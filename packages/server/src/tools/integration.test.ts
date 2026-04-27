import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeReadMemory } from "./integration.js";

describe("integration tools", () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-int-"));
		mkdirSync(join(dir, "memory"));
		writeFileSync(join(dir, "memory/client_profile.md"), "---\nclient_name: TestCo\n---\nbody");
	});

	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	it("read_memory returns frontmatter and body for allowed file", async () => {
		const tool = makeReadMemory(dir);
		const result = await tool.execute(
			{ file: "client_profile" },
			{ db: {} as never, agentSlug: "copywriter", agentSessionId: "s1", emit: vi.fn() },
		);
		expect(result.frontmatter.client_name).toBe("TestCo");
		expect(result.body).toContain("body");
	});

	it("read_memory rejects unknown files", async () => {
		const tool = makeReadMemory(dir);
		await expect(
			tool.execute(
				{ file: "unknown_file" },
				{ db: {} as never, agentSlug: "copywriter", agentSessionId: "s1", emit: vi.fn() },
			),
		).rejects.toThrow(/not allowed/i);
	});
});
