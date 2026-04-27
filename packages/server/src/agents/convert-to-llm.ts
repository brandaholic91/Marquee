import type {
	AgencyMessage,
	CustomMessage,
	StandardMessage,
} from "./messages.js";

const escapeXml = (s: string) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function serializeCustom(m: CustomMessage): StandardMessage {
	switch (m.type) {
		case "delegation_request":
			return {
				role: "user",
				content:
					`<delegation from="${m.from}" to="${m.to}">\n` +
					`task: ${escapeXml(m.payload.task)}\n` +
					(m.payload.context
						? `context: ${escapeXml(m.payload.context)}\n`
						: "") +
					`</delegation>`,
			};
		case "delegation_response":
			return {
				role: "user",
				content:
					`<delegation_result from="${m.from}" ok="${m.result.ok}">\n` +
					`${escapeXml(m.result.summary)}\n` +
					`</delegation_result>`,
			};
		case "brief_proposal":
			return {
				role: "assistant",
				content:
					`<brief_proposal id="${m.id}">\n` +
					`title: ${escapeXml(m.draft.title)}\n` +
					`scope: ${escapeXml(m.draft.scope)}\n` +
					`deliverables: ${m.draft.deliverables.join(", ")}\n` +
					`</brief_proposal>`,
			};
		case "memory_proposal":
			return {
				role: "assistant",
				content:
					`<memory_proposal id="${m.id}" file="${m.file}">\n` +
					`${escapeXml(m.patch)}\n` +
					`</memory_proposal>`,
			};
		case "eval_report":
			return {
				role: "user",
				content:
					`<eval_report id="${m.id}">\n` +
					`brand_voice: ${m.scores.brand_voice}/5\n` +
					`factual_accuracy: ${m.scores.factual_accuracy}/5\n` +
					`usp_usage: ${m.scores.usp_usage}/5\n` +
					`summary: ${escapeXml(m.summary)}\n` +
					`</eval_report>`,
			};
		case "approval_decision":
			return {
				role: "user",
				content:
					`<approval_decision deliverable="${m.deliverableId}" decision="${m.decision}">\n` +
					(m.note ? escapeXml(m.note) : "") +
					`</approval_decision>`,
			};
		case "human_brief":
			return { role: "user", content: `<human_brief id="${m.briefId}"/>` };
	}
}

export function convertToLlm(messages: AgencyMessage[]): StandardMessage[] {
	return messages.map((m) =>
		"role" in m ? (m as StandardMessage) : serializeCustom(m as CustomMessage),
	);
}
