import { delegateToLead, delegateToSpecialist, submitToDirector } from "./delegation.js";
import { makeSubmitDeliverable, readDeliverable, respondToLead } from "./deliverables.js";
import { proposeBrief, proposeMemoryUpdate } from "./proposals.js";
import { requestInput, submitEvalReport } from "./misc.js";
import { makeReadMemory, webFetch } from "./integration.js";
import type { AgentToolDef } from "./types.js";

export function toolsForRole(role: string, dataDir: string): AgentToolDef<unknown, unknown>[] {
	const readMemory = makeReadMemory(dataDir);
	const submitDeliverable = makeSubmitDeliverable(dataDir);
	switch (role) {
		case "director":
			return [delegateToLead, proposeBrief, proposeMemoryUpdate, readMemory, webFetch, requestInput] as never;
		case "content-lead":
			return [delegateToSpecialist, submitToDirector, readMemory, requestInput] as never;
		case "copywriter":
			return [submitDeliverable, respondToLead, readMemory, proposeMemoryUpdate, webFetch] as never;
		case "eval-judge":
			return [submitEvalReport, readMemory, readDeliverable] as never;
		default:
			throw new Error(`unknown role: ${role}`);
	}
}
