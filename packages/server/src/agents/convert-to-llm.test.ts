import { describe, expect, it } from "vitest";
import { convertToLlm } from "./convert-to-llm.js";
import { newDelegationRequest, newBriefProposal } from "./messages.js";

describe("convertToLlm", () => {
	it("serializes a delegation_request into a tagged user message", () => {
		const m = newDelegationRequest({
			from: "director",
			to: "content-lead",
			payload: { task: "write 500-word post about X" },
		});
		const out = convertToLlm([m]);
		expect(out).toHaveLength(1);
		expect(out[0].role).toBe("user");
		expect(out[0].content).toContain("<delegation");
		expect(out[0].content).toContain("write 500-word");
	});

	it("passes standard messages through unchanged", () => {
		const out = convertToLlm([{ role: "user", content: "hi" }]);
		expect(out).toEqual([{ role: "user", content: "hi" }]);
	});

	it("serializes a brief_proposal into an assistant message with tag", () => {
		const m = newBriefProposal({
			from: "director",
			threadId: "t1",
			draft: { title: "Q2 plan", scope: "blog x3", deliverables: ["blog_post"] },
		});
		const out = convertToLlm([m]);
		expect(out[0].role).toBe("assistant");
		expect(out[0].content).toContain("<brief_proposal");
		expect(out[0].content).toContain("Q2 plan");
	});
});
