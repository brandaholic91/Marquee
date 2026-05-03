const json = (r: Response) => r.json();

function post<T>(path: string, body?: unknown): Promise<T> {
	const headers: Record<string, string> = {};
	let fetchBody: string | undefined;
	if (body !== undefined) {
		headers["content-type"] = "application/json";
		fetchBody = JSON.stringify(body);
	}
	return fetch(path, {
		method: "POST",
		headers,
		body: fetchBody,
	}).then(json);
}

function put<T>(path: string, body: unknown): Promise<T> {
	return fetch(path, {
		method: "PUT",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	}).then(json);
}

// -------------------------
// Briefs
// -------------------------
export const briefsApi = {
	list: (): Promise<unknown[]> => fetch("/api/briefs").then(json),
	update: (
		id: string,
		body: { title?: string; content_md?: string; campaign_name?: string | null },
	): Promise<{ ok: true }> =>
		fetch(`/api/briefs/${id}`, {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		}).then(json),
	create: (body: {
		title: string;
		content_md: string;
		deliverable_type: string;
		target_specialist: string;
		platform?: string;
	}): Promise<{ brief_id: string }> => post("/api/briefs", body),
	dispatch: (id: string): Promise<{ ok: true } | { error: string }> => post(`/api/briefs/${id}/dispatch`),
};

// -------------------------
// Deliverables
// -------------------------
export interface DeliverableRow {
	id: string;
	type: string;
	title: string | null;
	status: string;
	updatedAt: number;
	delegationId: string;
	clientSlug: string;
	campaignId: string | null;
	currentRevisionId: string | null;
	createdAt: number;
}

export interface DeliverableDetail {
	deliverable: DeliverableRow;
	revisions: unknown[];
}

export const deliverablesApi = {
	list: (status?: string): Promise<DeliverableRow[]> => {
		const qs = status ? `?status=${encodeURIComponent(status)}` : "";
		return fetch(`/api/deliverables${qs}`).then(json);
	},
	get: (id: string): Promise<DeliverableDetail> => fetch(`/api/deliverables/${id}`).then(json),
	approve: (id: string): Promise<{ ok: true }> => post(`/api/deliverables/${id}/approve`),
	return: (id: string, note?: string): Promise<{ ok: true }> => post(`/api/deliverables/${id}/return`, { note }),
	discard: (id: string, note?: string): Promise<{ ok: true }> => post(`/api/deliverables/${id}/discard`, { note }),
	handoff: (
		id: string,
		body: {
			target_role: "copywriter";
			brief_overrides?: { title?: string; description?: string; campaign_name?: string };
		},
	): Promise<{ brief_id: string }> => post(`/api/deliverables/${id}/handoff`, body),
};
// -------------------------
// Memory
// -------------------------
export const memoryApi = {
	files: (slug: string): Promise<{ file: string; exists: boolean }[]> =>
		fetch(`/api/memory/clients/${slug}/files`).then(json),
	get: (slug: string, file: string): Promise<{ frontmatter: unknown; body: string; rawContent: string }> =>
		fetch(`/api/memory/clients/${slug}/${file}`).then(json),
	put: (slug: string, file: string, content: string): Promise<{ ok: true }> =>
		put(`/api/memory/clients/${slug}/${file}`, { content }),
	proposals: (slug: string, status?: string): Promise<unknown[]> => {
		const qs = status ? `?status=${encodeURIComponent(status)}` : "";
		return fetch(`/api/memory/clients/${slug}/proposals${qs}`).then(json);
	},
	approveProposal: (id: string): Promise<{ ok: true }> => post(`/api/memory/proposals/${id}/approve`),
	rejectProposal: (id: string): Promise<{ ok: true }> => post(`/api/memory/proposals/${id}/reject`),
	audit: (slug: string, file: string): Promise<unknown[]> =>
		fetch(`/api/memory/clients/${slug}/${file}/audit`).then(json),
};

// -------------------------
// Threads
// -------------------------
export interface ThreadRow {
	id: string;
	clientSlug: string;
	title: string | null;
	archivedAt: number | null;
	campaignId?: string | null;
}

export const threadsApi = {
	list: (opts?: { campaignId?: string }): Promise<ThreadRow[]> => {
		const qs = opts?.campaignId ? `?campaign_id=${encodeURIComponent(opts.campaignId)}` : "";
		return fetch(`/api/threads${qs}`).then(json);
	},
	create: (title?: string, campaignId?: string | null): Promise<{ thread_id: string }> =>
		post("/api/threads", { title, campaign_id: campaignId ?? null }),
	rename: (id: string, title: string): Promise<{ ok: true }> =>
		fetch(`/api/threads/${id}`, {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ title }),
		}).then(json),
	archive: (id: string): Promise<{ ok: true }> => post(`/api/threads/${id}/archive`),
};

// -------------------------
// Campaigns
// -------------------------
export interface CampaignRow {
	id: string;
	title: string;
	status: "active" | "completed" | "archived";
	createdAt: number;
	deliverableCount: number;
	pendingApprovals: number;
	plan_summary?: {
		has_plan: boolean;
		calendar_progress: null | {
			planned: number;
			brief_created: number;
			delivered: number;
			cancelled: number;
		};
	};
}

export interface CampaignDetail extends CampaignRow {
	deliverables: DeliverableRow[];
}

export interface CampaignPlan {
	id: string;
	campaignId: string;
	goal: string;
	goalType: "lead-gen" | "awareness" | "nurture" | "activation" | "retention" | "other";
	audience: string;
	keyMessages: Array<{ id: string; text: string }>;
	channelMix: Array<{ channel: string; weight: number; note?: string }>;
	timelineStart: number | null;
	timelineEnd: number | null;
	kpi: string;
	createdAt: number;
	updatedAt: number;
}

export interface CalendarItem {
	id: string;
	planId: string;
	campaignId: string;
	channel: "linkedin" | "email" | "blog" | "landing" | "ad" | "other";
	deliverableType: string | null;
	targetDate: number;
	intent: string;
	keyMessageRef: string | null;
	status: "planned" | "brief_created" | "delivered" | "cancelled";
	createdAt: number;
	updatedAt: number;
}

export const campaignsApi = {
	list: (): Promise<CampaignRow[]> => fetch("/api/campaigns").then(json),
	get: (id: string): Promise<CampaignDetail> => fetch(`/api/campaigns/${id}`).then(json),
	patch: (id: string, body: { title?: string; status?: string }): Promise<{ ok: true }> =>
		fetch(`/api/campaigns/${id}`, {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		}).then(json),
};

export const plansApi = {
	get: (campaignId: string): Promise<{ plan: CampaignPlan | null; calendar_items: CalendarItem[] }> =>
		fetch(`/api/campaigns/${campaignId}/plan`).then(json),
	put: (
		campaignId: string,
		body: {
			goal?: string;
			goal_type?: CampaignPlan["goalType"];
			audience?: string;
			key_messages?: Array<{ id: string; text: string }>;
			channel_mix?: Array<{ channel: string; weight: number; note?: string }>;
			timeline_start?: number | null;
			timeline_end?: number | null;
			kpi?: string;
		},
	): Promise<{ ok: true; plan_id: string }> => put(`/api/campaigns/${campaignId}/plan`, body),
	createCalendarItem: (
		campaignId: string,
		body: {
			channel: CalendarItem["channel"];
			deliverable_type?: string | null;
			target_date: number;
			intent: string;
			key_message_ref?: string | null;
		},
	): Promise<{ item_id: string }> => post(`/api/campaigns/${campaignId}/plan/calendar-items`, body),
	updateCalendarItem: (
		campaignId: string,
		itemId: string,
		body: Partial<{
			channel: CalendarItem["channel"];
			deliverable_type: string | null;
			target_date: number;
			intent: string;
			key_message_ref: string | null;
		}>,
	): Promise<{ ok: true }> =>
		fetch(`/api/campaigns/${campaignId}/plan/calendar-items/${itemId}`, {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		}).then(json),
	deleteCalendarItem: (campaignId: string, itemId: string): Promise<{ ok: true }> =>
		fetch(`/api/campaigns/${campaignId}/plan/calendar-items/${itemId}`, { method: "DELETE" }).then(json),
};

export const proposalsApi = {
	accept: (messageId: string): Promise<{ ok: true }> => post(`/api/proposals/${messageId}/accept`),
	discard: (messageId: string): Promise<{ ok: true }> => post(`/api/proposals/${messageId}/discard`),
};

// -------------------------
// Messages
// -------------------------
export interface MessageRow {
	id: string;
	threadId: string | null;
	agentSessionId: string | null;
	sender: string;
	type: string;
	contentJson: string;
	ts: number;
}

export const messagesApi = {
	list: (threadId: string): Promise<MessageRow[]> =>
		fetch(`/api/messages?thread_id=${encodeURIComponent(threadId)}`).then(json),
	post: (threadId: string, content: string): Promise<{ message_id: string }> =>
		post("/api/messages", { thread_id: threadId, content }),
};

// -------------------------
// Reviews
// -------------------------
export interface ReviewComment {
	quote: string;
	issue: string;
	severity: "info" | "warn" | "error";
}

export interface ReviewSuggestion {
	original: string;
	suggested: string;
	reasoning: string;
}

export interface ReviewRow {
	id: string;
	deliverableId: string;
	reviewerRole: string;
	score: number;
	comments: ReviewComment[];
	suggestions: ReviewSuggestion[];
	summary: string;
	createdAt: number;
}

export const reviewsApi = {
	trigger: (deliverableId: string): Promise<{ ok: true }> => post(`/api/deliverables/${deliverableId}/review`),
	list: (deliverableId: string): Promise<ReviewRow[]> => fetch(`/api/deliverables/${deliverableId}/reviews`).then(json),
};

// -------------------------
// Dashboard
// -------------------------
export const dashboardApi = {
	activity: (): Promise<DeliverableRow[]> => fetch("/api/deliverables").then(json),
};

// -------------------------
// Agents
// -------------------------

export interface AgentSummary {
	role: string;
	name: string;
	lifecycle: "warm" | "transient";
	model: string;
	thinkingLevel: string;
	tools: string[];
	skillCount: number;
	description: string;
}

export interface AgentSkillMeta {
	name: string;
	description: string;
}

export interface AgentSkillFull extends AgentSkillMeta {
	body: string;
}

export interface AgentConfigPayload {
	model?: string;
	thinking_level?: string;
}

export const agentsApi = {
	list: (): Promise<AgentSummary[]> => fetch("/api/agents").then(json),

	getIdentity: (role: string): Promise<{ body: string }> =>
		fetch(`/api/agents/${role}/identity`).then(json),

	putIdentity: (role: string, body: string): Promise<{ ok: true }> =>
		put(`/api/agents/${role}/identity`, { body }),

	listSkills: (role: string): Promise<AgentSkillMeta[]> =>
		fetch(`/api/agents/${role}/skills`).then(json),

	getSkill: (role: string, name: string): Promise<AgentSkillFull> =>
		fetch(`/api/agents/${role}/skills/${name}`).then(json),

	putSkill: (role: string, name: string, data: { description: string; body: string }): Promise<{ ok: true }> =>
		put(`/api/agents/${role}/skills/${name}`, data),

	postSkill: (role: string, data: { name: string; description: string; body: string }): Promise<{ ok: true }> =>
		post(`/api/agents/${role}/skills`, data),

	deleteSkill: (role: string, name: string): Promise<{ ok: true }> =>
		fetch(`/api/agents/${role}/skills/${name}`, { method: "DELETE" }).then(json),

	getConfig: (role: string): Promise<AgentConfigPayload> =>
		fetch(`/api/agents/${role}/config`).then(json),

	putConfig: (role: string, config: AgentConfigPayload): Promise<{ ok: true }> =>
		put(`/api/agents/${role}/config`, config),
};
