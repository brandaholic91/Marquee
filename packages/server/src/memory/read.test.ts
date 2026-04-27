import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readMemoryFile } from "./read.js";

describe("readMemoryFile", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "agency-mem-"));
		mkdirSync(join(dir, "memory"));
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	it("parses YAML frontmatter and body", () => {
		writeFileSync(
			join(dir, "memory/client_profile.md"),
			`---\nclient_name: Stackly\nicp: PLG SaaS\n---\n\n# Stackly\n\nbody here\n`,
		);
		const m = readMemoryFile(dir, "client_profile");
		expect(m.frontmatter.client_name).toBe("Stackly");
		expect(m.frontmatter.icp).toBe("PLG SaaS");
		expect(m.body.trim()).toContain("body here");
	});

	it("returns empty frontmatter for files without YAML", () => {
		writeFileSync(join(dir, "memory/notes.md"), "just text");
		const m = readMemoryFile(dir, "notes");
		expect(m.frontmatter).toEqual({});
		expect(m.body).toBe("just text");
	});
});
