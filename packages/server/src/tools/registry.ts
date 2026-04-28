import { delegateToLead, delegateToSpecialist, submitToDirector } from "./delegation.js";
import { makeSubmitDeliverable, readDeliverable, respondToLead } from "./deliverables.js";
import { proposeBrief, proposeMemoryUpdate } from "./proposals.js";
import { requestInput, submitEvalReport } from "./misc.js";
import { makeReadMemory, webFetch } from "./integration.js";
import { makeUseSkill } from "./skills.js";
import { makeCompleteOnboarding } from "./onboarding.js";
import { updateTask } from "./tasks.js";
import { queryMatomo } from "./matomo.js";
import { serpApiSearch } from "./serpapi.js";
import type { AgentToolDef } from "./types.js";

export function toolsForRole(role: string, dataDir: string): AgentToolDef<unknown, unknown>[] {
	const readMemory = makeReadMemory(dataDir);
	const submitDeliverable = makeSubmitDeliverable(dataDir);
	const useSkill = makeUseSkill(dataDir);
	const completeOnboarding = makeCompleteOnboarding(dataDir);
	switch (role) {
		case "director":
			return [delegateToLead, proposeBrief, proposeMemoryUpdate, readMemory, webFetch, requestInput, updateTask, useSkill, completeOnboarding] as never;
		case "content-lead":
			return [delegateToSpecialist, submitToDirector, readMemory, requestInput, updateTask, useSkill] as never;
		case "copywriter":
			return [submitDeliverable, respondToLead, readMemory, proposeMemoryUpdate, webFetch, useSkill] as never;
		case "eval-judge":
			return [submitEvalReport, readMemory, readDeliverable, useSkill] as never;
		case "distribution-lead":
			return [delegateToSpecialist, submitToDirector, readMemory, requestInput, updateTask, useSkill] as never;
		case "insights-lead":
			return [delegateToSpecialist, submitToDirector, readMemory, requestInput, updateTask, useSkill] as never;
		case "social-manager":
			return [submitDeliverable, respondToLead, readMemory, proposeMemoryUpdate, webFetch, useSkill] as never;
		case "seo-analyst":
			return [submitDeliverable, respondToLead, readMemory, webFetch, useSkill] as never;
		case "paid-specialist":
			return [submitDeliverable, respondToLead, readMemory, requestInput, useSkill] as never;
		case "repurposer":
			return [submitDeliverable, respondToLead, readMemory, useSkill] as never;
		case "analytics-analyst":
			return [submitDeliverable, respondToLead, readMemory, queryMatomo, serpApiSearch, useSkill] as never;
		default:
			throw new Error(`unknown role: ${role}`);
	}
}
