import { describe, expect, it } from "vitest";
import {
	type AgencyMessage,
	isDelegationRequest,
	isBriefProposal,
	newDelegationRequest,
} from "./messages.js";

describe("messages", () => {
	it("constructs a delegation_request message", () => {
		const m = newDelegationRequest({
			from: "director",
			to: "content-lead",
			payload: { briefId: "abc", task: "write a 500-word blog post" },
		});
		expect(m.type).toBe("delegation_request");
		expect(isDelegationRequest(m)).toBe(true);
		expect(isBriefProposal(m)).toBe(false);
	});
});
