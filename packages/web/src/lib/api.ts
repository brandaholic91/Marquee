const json = (r: Response) => r.json();

function post<T>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  let fetchBody: string | undefined;
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    fetchBody = JSON.stringify(body);
  }
  return fetch(path, {
    method: 'POST',
    headers,
    body: fetchBody,
  }).then(json);
}

function put<T>(path: string, body: unknown): Promise<T> {
  return fetch(path, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then(json);
}

// -------------------------
// Briefs
// -------------------------
export const briefsApi = {
  list: (): Promise<unknown[]> => fetch('/api/briefs').then(json),
  update: (id: string, body: { title?: string; content_md?: string; campaign_name?: string | null }): Promise<{ ok: true }> =>
    fetch(`/api/briefs/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(json),
  create: (body: {
    title: string;
    content_md: string;
    deliverable_type: string;
    target_specialist: string;
    platform?: string;
  }): Promise<{ brief_id: string }> => post('/api/briefs', body),
  dispatch: (id: string): Promise<{ ok: true } | { error: string }> =>
    post(`/api/briefs/${id}/dispatch`),
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
  currentRevisionId: string | null;
  createdAt: number;
}

export interface DeliverableDetail {
  deliverable: DeliverableRow;
  revisions: unknown[];
}

export const deliverablesApi = {
  list: (status?: string): Promise<DeliverableRow[]> => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return fetch(`/api/deliverables${qs}`).then(json);
  },
  get: (id: string): Promise<DeliverableDetail> =>
    fetch(`/api/deliverables/${id}`).then(json),
  approve: (id: string): Promise<{ ok: true }> =>
    post(`/api/deliverables/${id}/approve`),
  return: (id: string, note?: string): Promise<{ ok: true }> =>
    post(`/api/deliverables/${id}/return`, { note }),
  discard: (id: string, note?: string): Promise<{ ok: true }> =>
    post(`/api/deliverables/${id}/discard`, { note }),
};

// -------------------------
// Memory
// -------------------------
export const memoryApi = {
  files: (slug: string): Promise<{ file: string; exists: boolean }[]> =>
    fetch(`/api/memory/clients/${slug}/files`).then(json),
  get: (
    slug: string,
    file: string,
  ): Promise<{ frontmatter: unknown; body: string; rawContent: string }> =>
    fetch(`/api/memory/clients/${slug}/${file}`).then(json),
  put: (slug: string, file: string, content: string): Promise<{ ok: true }> =>
    put(`/api/memory/clients/${slug}/${file}`, { content }),
  proposals: (
    slug: string,
    status?: string,
  ): Promise<unknown[]> => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return fetch(`/api/memory/clients/${slug}/proposals${qs}`).then(json);
  },
  approveProposal: (id: string): Promise<{ ok: true }> =>
    post(`/api/memory/proposals/${id}/approve`),
  rejectProposal: (id: string): Promise<{ ok: true }> =>
    post(`/api/memory/proposals/${id}/reject`),
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
}

export const threadsApi = {
  list: (): Promise<ThreadRow[]> => fetch('/api/threads').then(json),
  create: (title?: string): Promise<{ thread_id: string }> =>
    post('/api/threads', { title }),
  rename: (id: string, title: string): Promise<{ ok: true }> =>
    fetch(`/api/threads/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title }),
    }).then(json),
  archive: (id: string): Promise<{ ok: true }> =>
    post(`/api/threads/${id}/archive`),
};

// -------------------------
// Campaigns
// -------------------------
export interface CampaignRow {
  id: string;
  title: string;
  status: 'active' | 'completed' | 'archived';
  createdAt: number;
  deliverableCount: number;
  pendingApprovals: number;
}

export interface CampaignDetail extends CampaignRow {
  deliverables: DeliverableRow[];
}

export const campaignsApi = {
  list: (): Promise<CampaignRow[]> => fetch('/api/campaigns').then(json),
  get: (id: string): Promise<CampaignDetail> => fetch(`/api/campaigns/${id}`).then(json),
  patch: (id: string, body: { title?: string; status?: string }): Promise<{ ok: true }> =>
    fetch(`/api/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(json),
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
  post: (
    threadId: string,
    content: string,
  ): Promise<{ message_id: string }> =>
    post('/api/messages', { thread_id: threadId, content }),
};

// -------------------------
// Reviews
// -------------------------
export interface ReviewComment {
  quote: string;
  issue: string;
  severity: 'info' | 'warn' | 'error';
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
  trigger: (deliverableId: string): Promise<{ ok: true }> =>
    post(`/api/deliverables/${deliverableId}/review`),
  list: (deliverableId: string): Promise<ReviewRow[]> =>
    fetch(`/api/deliverables/${deliverableId}/reviews`).then(json),
};

// -------------------------
// Dashboard
// -------------------------
export const dashboardApi = {
  activity: (): Promise<DeliverableRow[]> =>
    fetch('/api/deliverables').then(json),
};
