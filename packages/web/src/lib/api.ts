const json = (r: Response) => r.json();

function post<T>(path: string, body: unknown): Promise<T> {
  return fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then(json);
}

export const api = {
  threads: {
    list: () => fetch("/api/threads").then(json),
    create: (title: string) =>
      post<{ id: string }>("/api/threads", { title }),
    get: (id: string) => fetch(`/api/threads/${id}`).then(json),
    messages: (threadId: string) => fetch(`/api/threads/${threadId}/messages`).then(json),
    rename: (id: string, title: string) =>
      fetch(`/api/threads/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      }).then(json),
    delete: (id: string) => fetch(`/api/threads/${id}`, { method: "DELETE" }).then(json),
  },
  messages: {
    post: (threadId: string, text: string) =>
      fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadId, text }),
      }).then(json),
  },
  briefs: {
    list: () => fetch("/api/briefs").then(json),
    dispatch: (id: string) =>
      fetch(`/api/briefs/${id}/dispatch`, { method: "POST" }).then(json),
    create: (contentMd: string, campaignId?: string) =>
      post<{ id: string; ok: boolean }>("/api/briefs", { contentMd, ...(campaignId ? { campaignId } : {}) }),
  },
  approvals: {
    decide: (
      deliverableId: string,
      decision: "approved" | "rejected" | "requested_changes",
      note?: string,
    ) =>
      fetch(`/api/approvals/${deliverableId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, note }),
      }).then(json),
  },
  memory: {
    files: () => fetch("/api/memory/files").then(json),
    get: (filename: string) => fetch(`/api/memory/${filename}`).then(json),
    put: (filename: string, content: string) =>
      fetch(`/api/memory/${filename}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      }).then(json),
    create: (filename: string) =>
      post<{ ok: boolean; filename: string }>("/api/memory", { filename }),
    proposals: () => fetch("/api/memory-proposals").then(json),
    approve: (id: string) =>
      fetch(`/api/memory-proposals/${id}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: "approved" }),
      }).then(json),
    reject: (id: string) =>
      fetch(`/api/memory-proposals/${id}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: "rejected" }),
      }).then(json),
  },
  deliverables: {
    list: () => fetch("/api/deliverables").then(json),
    get: (id: string) => fetch(`/api/deliverables/${id}`).then(json),
    revision: (id: string, revId: string) =>
      fetch(`/api/deliverables/${id}/revisions/${revId}`).then(json),
    revisions: (id: string) =>
      fetch(`/api/deliverables/${id}/revisions`).then(json),
    eval: (id: string) =>
      fetch(`/api/deliverables/${id}/eval`).then(json),
    patchStatus: (id: string, status: string) =>
      fetch(`/api/deliverables/${id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      }).then(json),
    revisionContent: (revisionId: string) =>
      fetch(`/api/deliverables/revisions/${revisionId}/content`).then(json) as Promise<{ content: string }>,
    repurpose: (id: string, channels: string[]) =>
      post<{ delegationId: string }>(`/api/deliverables/${id}/repurpose`, { channels }),
  },
  campaigns: {
    list: () => fetch("/api/campaigns").then(json) as Promise<import("../store/useAgencyStore").Campaign[]>,
    get: (id: string) => fetch(`/api/campaigns/${id}`).then(json) as Promise<import("../store/useAgencyStore.js").CampaignDetail>,
    patch: (id: string, body: { title?: string; description?: string; status?: string }) =>
      fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then(json),
  },
  onboarding: {
    start: () => post<{ threadId: string }>("/api/onboarding/start", {}),
    save: (clientProfile: string, brandGuidelines: string) =>
      post<{ ok: boolean }>("/api/onboarding/save", { clientProfile, brandGuidelines }),
  },
  snapshot: () => fetch("/api/state/snapshot").then(json),
  tasks: {
    list: (params?: { assigned_to?: string; status?: string; campaignId?: string }) => {
      const qs = params
        ? "?" + new URLSearchParams(params as Record<string, string>).toString()
        : "";
      return fetch(`/api/tasks${qs}`).then(json) as Promise<import("../store/useAgencyStore").Task[]>;
    },
    patch: (id: string, body: { title?: string; description_md?: string; status?: string; current_version: number }) =>
      fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then(json),
  },
  agents: {
    getConfig: (role: string) => fetch(`/api/agents/${role}/config`).then(json),
    putConfig: (role: string, config: Record<string, unknown>) =>
      fetch(`/api/agents/${role}/config`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      }).then(json),
    getIdentity: (role: string) =>
      fetch(`/api/agents/${role}/identity`).then(json) as Promise<{ identity: string }>,
    putIdentity: (role: string, identity: string) =>
      fetch(`/api/agents/${role}/identity`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identity }),
      }).then(json),
  },
  skills: {
    list: () => fetch("/api/skills").then(json),
    create: (slug: string, content: string, agents: string[]) =>
      post("/api/skills", { slug, content, agents }),
    update: (slug: string, body: { content?: string; agents?: string[] }) =>
      fetch(`/api/skills/${slug}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then(json),
    delete: (slug: string) => fetch(`/api/skills/${slug}`, { method: "DELETE" }).then(json),
  },
  stats: {
    usage: () => fetch("/api/stats/usage").then(json) as Promise<{
      today: { tokens: number; costUsdCents: number; byAgent: { agentSlug: string; tokens: number; costUsdCents: number }[] };
      budgetCents: number;
      budgetUsedPct: number;
    }>,
    quality: () => fetch("/api/stats/quality").then(json) as Promise<{
      days: { date: string; brand_voice: number; factual_accuracy: number; usp_usage: number; count: number }[];
      avg: { brand_voice: number; factual_accuracy: number; usp_usage: number };
    }>,
  },
};
