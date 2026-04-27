type Handler = (payload: unknown, id: number) => void;

export class AgencyEvents {
  private es: EventSource | null = null;
  private subs = new Map<string, Set<Handler>>();

  start() {
    const lastId = localStorage.getItem("agency:lastEventId");
    const url = lastId ? `/api/events?lastEventId=${lastId}` : "/api/events";
    this.es = new EventSource(url);
    this.es.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data);
        const id = Number(msg.lastEventId);
        if (id) localStorage.setItem("agency:lastEventId", String(id));
        for (const h of this.subs.get(msg.type) ?? []) h(payload, id);
        for (const h of this.subs.get("*") ?? []) h({ type: msg.type, payload }, id);
      } catch {}
    };
    this.es.onerror = () => {
      this.es?.close();
      setTimeout(() => this.start(), 2000);
    };
  }

  stop() {
    this.es?.close();
    this.es = null;
  }

  on(type: string, h: Handler) {
    let s = this.subs.get(type);
    if (!s) {
      s = new Set();
      this.subs.set(type, s);
    }
    s.add(h);
    return () => s!.delete(h);
  }
}

export const agencyEvents = new AgencyEvents();
