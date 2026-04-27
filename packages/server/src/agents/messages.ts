import { randomUUID } from "node:crypto";

export type StandardMessage =
	| { role: "user"; content: string }
	| { role: "assistant"; content: string }
	| { role: "tool"; toolCallId: string; content: string };

export interface DelegationRequestMessage {
	type: "delegation_request";
	id: string;
	from: string;
	to: string;
	payload: { briefId?: string; deliverableId?: string; task: string; context?: string };
	ts: number;
}

export interface DelegationResponseMessage {
	type: "delegation_response";
	id: string;
	delegationId: string;
	from: string;
	to: string;
	result: { ok: boolean; deliverableId?: string; summary: string };
	ts: number;
}

export interface BriefProposalMessage {
	type: "brief_proposal";
	id: string;
	from: string;
	threadId: string;
	draft: { title: string; scope: string; deliverables: string[]; deadline?: string };
	ts: number;
}

export interface MemoryProposalMessage {
	type: "memory_proposal";
	id: string;
	from: string;
	file: string;
	patch: string;
	ts: number;
}

export interface EvalReportMessage {
	type: "eval_report";
	id: string;
	deliverableRevisionId: string;
	scores: { brand_voice: number; factual_accuracy: number; usp_usage: number };
	summary: string;
	ts: number;
}

export interface ApprovalDecisionMessage {
	type: "approval_decision";
	id: string;
	deliverableId: string;
	decision: "approved" | "rejected" | "requested_changes";
	note?: string;
	ts: number;
}

export interface HumanBriefMessage {
	type: "human_brief";
	id: string;
	briefId: string;
	ts: number;
}

export type CustomMessage =
	| DelegationRequestMessage
	| DelegationResponseMessage
	| BriefProposalMessage
	| MemoryProposalMessage
	| EvalReportMessage
	| ApprovalDecisionMessage
	| HumanBriefMessage;

export type AgencyMessage = StandardMessage | CustomMessage;

export const newDelegationRequest = (
	args: Omit<DelegationRequestMessage, "type" | "id" | "ts">,
): DelegationRequestMessage => ({
	type: "delegation_request",
	id: randomUUID(),
	ts: Date.now(),
	...args,
});

export const newDelegationResponse = (
	args: Omit<DelegationResponseMessage, "type" | "id" | "ts">,
): DelegationResponseMessage => ({
	type: "delegation_response",
	id: randomUUID(),
	ts: Date.now(),
	...args,
});

export const newBriefProposal = (
	args: Omit<BriefProposalMessage, "type" | "id" | "ts">,
): BriefProposalMessage => ({
	type: "brief_proposal",
	id: randomUUID(),
	ts: Date.now(),
	...args,
});

export const newMemoryProposal = (
	args: Omit<MemoryProposalMessage, "type" | "id" | "ts">,
): MemoryProposalMessage => ({
	type: "memory_proposal",
	id: randomUUID(),
	ts: Date.now(),
	...args,
});

export const newEvalReport = (
	args: Omit<EvalReportMessage, "type" | "id" | "ts">,
): EvalReportMessage => ({
	type: "eval_report",
	id: randomUUID(),
	ts: Date.now(),
	...args,
});

export const isCustom = (m: AgencyMessage): m is CustomMessage => {
	if (!("type" in m)) return false;
	const type = (m as { type: unknown }).type;
	return (
		type === "delegation_request" ||
		type === "delegation_response" ||
		type === "brief_proposal" ||
		type === "memory_proposal" ||
		type === "eval_report" ||
		type === "approval_decision" ||
		type === "human_brief"
	);
};

export const isDelegationRequest = (m: AgencyMessage): m is DelegationRequestMessage =>
	isCustom(m) && m.type === "delegation_request";

export const isBriefProposal = (m: AgencyMessage): m is BriefProposalMessage =>
	isCustom(m) && m.type === "brief_proposal";

export const isEvalReport = (m: AgencyMessage): m is EvalReportMessage =>
	isCustom(m) && m.type === "eval_report";
