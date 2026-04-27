import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeTransformContext } from "./transform-context.js";

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

	it("prunes when message count exceeds keepRecent", async () => {
		const tc = makeTransformContext({ dataDir: dir, role: "copywriter", keepRecent: 5 });
		const many = Array.from({ length: 20 }, (_, i) => ({ role: "user" as const, content: `m${i}` }));
		const out = await tc(many);
		// 1 memory block + 1 summary + 5 recent = 7
		expect(out.length).toBeLessThanOrEqual(7);
		expect(out.some((m) => "content" in m && m.content.includes("[earlier turns summarized"))).toBe(true);
	});
});
