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
      fetch("/api/threads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      }).then(json),
    messages: (threadId: string) => fetch(`/api/threads/${threadId}/messages`).then(json),
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
    create: (body: { title?: string; contentMd: string }) =>
      post<{ id: string; ok: boolean }>("/api/briefs", body),
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
  deliverables: {
    list: () => fetch("/api/deliverables").then(json),
    get: (id: string) => fetch(`/api/deliverables/${id}`).then(json),
    revision: (id: string, revId: string) =>
      fetch(`/api/deliverables/${id}/revisions/${revId}`).then(json),
  },
  memory: {
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
  snapshot: () => fetch("/api/state/snapshot").then(json),
};
