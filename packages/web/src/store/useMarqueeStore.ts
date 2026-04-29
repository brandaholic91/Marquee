import { create } from 'zustand';
import { briefsApi, deliverablesApi, type DeliverableRow, type ThreadRow, memoryApi, messagesApi, threadsApi } from '../lib/api.js';

import { marqueeEvents } from '../lib/sse.js';

export interface Message {
  id: string;
  type: 'chat' | 'brief_proposal' | 'memory_proposal' | 'tool_call' | 'tool_result' | 'system';
  sender: 'user' | 'director' | 'system';
  text: string;
  briefId?: string;
  toolName?: string;
  ts: number;
}

export interface ProposedBrief {
  briefId: string;
  title: string;
  contentMd: string;
  deliverableType: string;
  targetSpecialist: string;
  platform: string | null;
}

export type Deliverable = DeliverableRow;

interface MarqueeStore {
  // Threads
  threads: ThreadRow[];
  threadId: string | null;

  // Chat
  messages: Message[];

  // Brief proposals (in-flight from agents — appear as inline cards in chat)
  proposedBriefs: ProposedBrief[];

  // Counters / flags
  awaitingApprovalCount: number;
  memoryEmpty: boolean;

  // Approvals view data
  deliverables: Deliverable[];

  // Active agent indicator
  activeAgents: Set<string>;

  // Actions
  fetchInitialState: () => Promise<void>;
  createThread: (title?: string) => Promise<void>;
  selectThread: (id: string) => Promise<void>;
  archiveThread: (id: string) => Promise<void>;
  renameThread: (id: string, title: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  updateBrief: (id: string, title: string, contentMd: string) => Promise<void>;
  dispatchBrief: (id: string) => Promise<void>;
  discardBrief: (id: string) => Promise<void>;
  fetchDeliverables: (statusFilter?: string) => Promise<void>;
  approveDeliverable: (id: string) => Promise<void>;
  returnDeliverable: (id: string, note: string) => Promise<void>;
  discardDeliverable: (id: string, note?: string) => Promise<void>;
}

// Helper to turn a raw server message into a Message
function mapServerMessage(raw: {
  id: string;
  sender?: string;
  role?: string;
  text?: string;
  content?: string;
  contentJson?: string;
  ts?: number;
  created_at?: number;
  createdAt?: number;
}): Message {
  const text = raw.text
    ?? (raw.contentJson
      ? (() => {
          try {
            const parsed = JSON.parse(raw.contentJson) as { text?: string };
            return parsed.text ?? raw.content ?? '';
          } catch {
            return raw.content ?? '';
          }
        })()
      : (raw.content ?? ''));

  const senderRaw = raw.sender ?? raw.role ?? 'system';
  const sender: Message['sender'] =
    senderRaw === 'user' || senderRaw === 'human' ? 'user' : senderRaw === 'director' ? 'director' : 'system';

  return {
    id: raw.id,
    type: 'chat',
    sender,
    text,
    ts: (raw.ts ?? raw.created_at ?? raw.createdAt ?? Date.now()),
  };
}

// Module-level guard: prevents duplicate SSE handler registration in React StrictMode.
let sseHandlersRegistered = false;

export const useMarqueeStore = create<MarqueeStore>((set, get) => ({
  threads: [],
  threadId: null,
  messages: [],
  proposedBriefs: [],
  awaitingApprovalCount: 0,
  memoryEmpty: false,
  deliverables: [],
  activeAgents: new Set<string>(),

  fetchInitialState: async () => {
    // 1. Fetch (or auto-create) threads
    const threads = await threadsApi.list();
    const currentId = get().threadId;
    // Keep existing active thread if it's still in the list; otherwise pick first
    const threadId = (currentId && threads.find((t) => t.id === currentId))
      ? currentId
      : (threads[0]?.id ?? null);
    set({ threads, threadId });

    // 2. Fetch messages only if thread changed (avoid wiping in-flight messages)
    if (threadId && threadId !== currentId) {
      const rawMessages = await messagesApi.list(threadId);
      const messages: Message[] = rawMessages.map(mapServerMessage);
      set({ messages });
    } else if (threadId && !currentId) {
      const rawMessages = await messagesApi.list(threadId);
      const messages: Message[] = rawMessages.map(mapServerMessage);
      set({ messages });
    }

    // 3. Check memory: if profile.md doesn't exist → memoryEmpty=true
    try {
      const files = await memoryApi.files('default');
      const profileFile = files.find((f) => f.file === 'profile.md');
      set({ memoryEmpty: !profileFile || !profileFile.exists });
    } catch {
      // If endpoint not available, assume memory exists
      set({ memoryEmpty: false });
    }

    // 4. Count awaiting_approval deliverables
    try {
      const awaiting = await deliverablesApi.list('awaiting_approval');
      set({ awaitingApprovalCount: awaiting.length });
    } catch {
      set({ awaitingApprovalCount: 0 });
    }

    // 5. Start SSE
    marqueeEvents.start();

    // Guard: register handlers exactly once even under React StrictMode double-mount
    if (sseHandlersRegistered) return;
    sseHandlersRegistered = true;

    // chat_message: agent message arrives
    marqueeEvents.on<{
      type: string;
      sender?: string;
      role?: string;
      id?: string;
      message_id?: string;
      text?: string;
      content?: string;
      contentJson?: string;
      thread_id?: string;
      ts?: number;
    }>('chat_message', (payload) => {
      // Skip user messages (already added optimistically)
      const senderRaw = payload.sender ?? payload.role ?? '';
      if (senderRaw === 'user' || senderRaw === 'human') return;
      // Only show messages belonging to the currently active thread
      const activeThreadId = get().threadId;
      if (payload.thread_id && payload.thread_id !== activeThreadId) return;
      const msg = mapServerMessage({
        id: payload.id ?? payload.message_id ?? String(Date.now()),
        sender: senderRaw,
        text: payload.text,
        content: payload.content,
        contentJson: payload.contentJson,
        ts: payload.ts,
      });
      set((s) => {
        // Dedupe by id (defends against SSE replay echoing already-fetched messages)
        if (s.messages.some((m) => m.id === msg.id)) return s;
        return { messages: [...s.messages, msg] };
      });
    });

    // brief_proposed: push card + message
    marqueeEvents.on<{
      type: string;
      brief_id?: string;
      briefId?: string;
      title?: string;
      content_md?: string;
      contentMd?: string;
      deliverable_type?: string;
      deliverableType?: string;
      target_specialist?: string;
      targetSpecialist?: string;
      platform?: string | null;
    }>('brief_proposed', (payload) => {
      const briefId = payload.brief_id ?? payload.briefId ?? '';
      const title = payload.title ?? '';
      const contentMd = payload.content_md ?? payload.contentMd ?? '';
      const deliverableType = payload.deliverable_type ?? payload.deliverableType ?? '';
      const targetSpecialist = payload.target_specialist ?? payload.targetSpecialist ?? '';
      const platform = payload.platform ?? null;

      const brief: ProposedBrief = { briefId, title, contentMd, deliverableType, targetSpecialist, platform };

      const cardMsg: Message = {
        id: `brief_card_${briefId}`,
        type: 'brief_proposal',
        sender: 'director',
        text: '',
        briefId,
        ts: Date.now(),
      };

      set((s) => ({
        proposedBriefs: [...s.proposedBriefs, brief],
        messages: [...s.messages, cardMsg],
      }));
    });

    // brief_dispatched: remove from proposedBriefs
    marqueeEvents.on<{ type: string; brief_id?: string; briefId?: string }>('brief_dispatched', (payload) => {
      const briefId = payload.brief_id ?? payload.briefId ?? '';
      set((s) => ({
        proposedBriefs: s.proposedBriefs.filter((b) => b.briefId !== briefId),
      }));
    });

    // deliverable_submitted: increment counter
    marqueeEvents.on('deliverable_submitted', () => {
      set((s) => ({ awaitingApprovalCount: s.awaitingApprovalCount + 1 }));
    });

    // deliverable_approved / deliverable_discarded: decrement counter
    marqueeEvents.on('deliverable_approved', () => {
      set((s) => ({ awaitingApprovalCount: Math.max(0, s.awaitingApprovalCount - 1) }));
    });
    marqueeEvents.on('deliverable_discarded', () => {
      set((s) => ({ awaitingApprovalCount: Math.max(0, s.awaitingApprovalCount - 1) }));
    });

    // delegation_started: add agent_slug to activeAgents
    marqueeEvents.on<{ type: string; agent_slug?: string; agentSlug?: string }>('delegation_started', (payload) => {
      const slug = payload.agent_slug ?? payload.agentSlug ?? '';
      if (!slug) return;
      set((s) => {
        const next = new Set(s.activeAgents);
        next.add(slug);
        return { activeAgents: next };
      });
    });

    // error: push system message
    marqueeEvents.on<{ type: string; source?: string; message?: string; error?: string }>('error', (payload) => {
      // Infra-level recovery noise — suppress
      if (payload.source === 'recovery') return;
      const text = payload.message ?? payload.error ?? 'Ismeretlen hiba';
      const errMsg: Message = {
        id: `err_${Date.now()}`,
        type: 'system',
        sender: 'system',
        text: `Hiba: ${text}`,
        ts: Date.now(),
      };
      set((s) => ({ messages: [...s.messages, errMsg] }));
    });

    // memory_edited: re-check profile.md existence
    marqueeEvents.on<{ type: string; file?: string }>('memory_edited', async (payload) => {
      if (payload.file === 'profile.md' || !payload.file) {
        try {
          const files = await memoryApi.files('default');
          const profileFile = files.find((f) => f.file === 'profile.md');
          set({ memoryEmpty: !profileFile || !profileFile.exists });
        } catch {
          // ignore
        }
      }
    });

    // No-op registrations for completeness (SSE spec requires all 12 handled)
    // memory_proposed, memory_decided, deliverable_returned — no state change needed here
    marqueeEvents.on('memory_proposed', () => {});
    marqueeEvents.on('memory_decided', () => {});
    marqueeEvents.on('deliverable_returned', () => {});
  },

  sendMessage: async (text: string) => {
    const { threadId } = get();
    if (!threadId) return;

    // Optimistic add
    const optimisticMsg: Message = {
      id: `optimistic_${Date.now()}`,
      type: 'chat',
      sender: 'user',
      text,
      ts: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, optimisticMsg] }));

    // Mark director as active
    set((s) => {
      const next = new Set(s.activeAgents);
      next.add('director');
      return { activeAgents: next };
    });

    try {
      await messagesApi.post(threadId, text);
    } catch {
      // Push error message
      const errMsg: Message = {
        id: `err_send_${Date.now()}`,
        type: 'system',
        sender: 'system',
        text: 'Üzenet küldése sikertelen. Próbáld újra.',
        ts: Date.now(),
      };
      set((s) => ({ messages: [...s.messages, errMsg] }));
    }
  },

  updateBrief: async (id: string, title: string, contentMd: string) => {
    await briefsApi.update(id, { title, content_md: contentMd });
    set((s) => ({
      proposedBriefs: s.proposedBriefs.map((b) =>
        b.briefId === id ? { ...b, title, contentMd } : b,
      ),
    }));
  },

  dispatchBrief: async (id: string) => {
    await briefsApi.dispatch(id);
    // Remove locally (SSE will also fire brief_dispatched — idempotent)
    set((s) => ({
      proposedBriefs: s.proposedBriefs.filter((b) => b.briefId !== id),
    }));
  },

  discardBrief: (id: string) => {
    // MVP: local only, no backend call
    set((s) => ({
      proposedBriefs: s.proposedBriefs.filter((b) => b.briefId !== id),
    }));
    return Promise.resolve();
  },

  createThread: async (title?: string) => {
    const { thread_id } = await threadsApi.create(title);
    const allThreads = await threadsApi.list();
    const messages: Message[] = [];
    set({ threads: allThreads, threadId: thread_id, messages, proposedBriefs: [] });
  },

  selectThread: async (id: string) => {
    if (get().threadId === id) return;
    const rawMessages = await messagesApi.list(id);
    const messages: Message[] = rawMessages.map(mapServerMessage);
    set({ threadId: id, messages, proposedBriefs: [] });
  },

  archiveThread: async (id: string) => {
    await threadsApi.archive(id);
    const allThreads = await threadsApi.list();
    const active = allThreads.filter((t) => !t.archivedAt);
    const nextId = active[0]?.id ?? null;
    if (nextId && nextId !== id) {
      const rawMessages = await messagesApi.list(nextId);
      const messages: Message[] = rawMessages.map(mapServerMessage);
      set({ threads: allThreads, threadId: nextId, messages, proposedBriefs: [] });
    } else if (!nextId) {
      // All archived: create a fresh thread
      const { thread_id } = await threadsApi.create();
      const updated = await threadsApi.list();
      set({ threads: updated, threadId: thread_id, messages: [], proposedBriefs: [] });
    } else {
      set({ threads: allThreads });
    }
  },

  renameThread: async (id: string, title: string) => {
    await threadsApi.rename(id, title);
    set((s) => ({
      threads: s.threads.map((t) => t.id === id ? { ...t, title } : t),
    }));
  },

  fetchDeliverables: async (statusFilter?: string) => {
    const deliverables = await deliverablesApi.list(statusFilter);
    set({ deliverables });
    if (statusFilter === 'awaiting_approval') {
      set({ awaitingApprovalCount: deliverables.length });
    }
  },

  approveDeliverable: async (id: string) => {
    await deliverablesApi.approve(id);
    set((s) => ({
      deliverables: s.deliverables.map((d) =>
        d.id === id ? { ...d, status: 'approved' } : d,
      ),
      awaitingApprovalCount: Math.max(0, s.awaitingApprovalCount - 1),
    }));
  },

  returnDeliverable: async (id: string, note: string) => {
    await deliverablesApi.return(id, note);
    set((s) => ({
      deliverables: s.deliverables.map((d) =>
        d.id === id ? { ...d, status: 'returned' } : d,
      ),
    }));
  },

  discardDeliverable: async (id: string, note?: string) => {
    await deliverablesApi.discard(id, note);
    set((s) => ({
      deliverables: s.deliverables.map((d) =>
        d.id === id ? { ...d, status: 'discarded' } : d,
      ),
      awaitingApprovalCount: Math.max(0, s.awaitingApprovalCount - 1),
    }));
  },
}));
