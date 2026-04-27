import { describe, expect, it } from "vitest";
import { toolsForRole } from "./registry.js";

describe("tool registry — hierarchy enforcement", () => {
	it("director gets delegate_to_lead but NOT delegate_to_specialist", () => {
		const names = toolsForRole("director", "/tmp").map((t) => t.name);
		expect(names).toContain("delegate_to_lead");
		expect(names).not.toContain("delegate_to_specialist");
		expect(names).toContain("propose_brief");
	});

	it("content-lead gets delegate_to_specialist but NOT delegate_to_lead", () => {
		const names = toolsForRole("content-lead", "/tmp").map((t) => t.name);
		expect(names).toContain("delegate_to_specialist");
		expect(names).not.toContain("delegate_to_lead");
		expect(names).toContain("submit_to_director");
	});

	it("copywriter (specialist) has NO delegate tools and NO submit_to_director", () => {
		const names = toolsForRole("copywriter", "/tmp").map((t) => t.name);
		expect(names).not.toContain("delegate_to_lead");
		expect(names).not.toContain("delegate_to_specialist");
		expect(names).not.toContain("submit_to_director");
		expect(names).toContain("submit_deliverable");
		expect(names).toContain("respond_to_lead");
	});

	it("eval-judge has read_deliverable but NOT submit_deliverable", () => {
		const names = toolsForRole("eval-judge", "/tmp").map((t) => t.name);
		expect(names).toContain("submit_eval_report");
		expect(names).toContain("read_deliverable");
		expect(names).not.toContain("submit_deliverable");
	});
});
