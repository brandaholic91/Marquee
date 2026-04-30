// Typed SSE event types for Marquee v1
export type SseEventType =
  | 'chat_message'
  | 'brief_proposed'
  | 'brief_dispatched'
  | 'delegation_started'
  | 'deliverable_submitted'
  | 'deliverable_approved'
  | 'deliverable_returned'
  | 'deliverable_discarded'
  | 'memory_proposed'
  | 'memory_decided'
  | 'memory_edited'
  | 'review_completed'
  | 'plan.proposed'
  | 'plan.updated'
  | 'plan.accepted'
  | 'plan.discarded'
  | 'calendar_item.added'
  | 'calendar_item.updated'
  | 'calendar_item.deleted'
  | 'calendar_item.status_changed'
  | 'proposal.accepted'
  | 'proposal.discarded'
  | 'error';

type Handler<T = unknown> = (payload: T) => void;

export class MarqueeEvents {
  private es: EventSource | null = null;
  private subs = new Map<string, Set<Handler<unknown>>>();

  start() {
    if (this.es) return;
    const lastId = localStorage.getItem('marquee:lastEventId');
    const url = lastId ? `/api/events?lastEventId=${lastId}` : '/api/events';
    this.es = new EventSource(url);
    this.es.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data) as Record<string, unknown>;
        const id = msg.lastEventId;
        if (id) localStorage.setItem('marquee:lastEventId', id);
        const type = (payload.type as string | undefined) ?? 'unknown';
        for (const h of this.subs.get(type) ?? []) h(payload);
        for (const h of this.subs.get('*') ?? []) h(payload);
      } catch {
        // ignore parse errors
      }
    };
    this.es.onerror = () => {
      this.es?.close();
      this.es = null;
      setTimeout(() => this.start(), 2000);
    };
  }

  stop() {
    this.es?.close();
    this.es = null;
  }

  handlersInitialized = false;

  clearAndReinit() {
    this.subs.clear();
    this.handlersInitialized = false;
  }

  on<T = unknown>(type: SseEventType | '*', handler: Handler<T>): () => void {
    let set = this.subs.get(type);
    if (!set) {
      set = new Set();
      this.subs.set(type, set);
    }
    set.add(handler as Handler<unknown>);
    return () => set!.delete(handler as Handler<unknown>);
  }
}

export const marqueeEvents = new MarqueeEvents();
