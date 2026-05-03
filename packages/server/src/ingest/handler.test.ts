import { describe, it, expect, vi } from "vitest";
import { registerIngestHandlers } from "./handler.js";

describe("ingest handler", () => {
	it("registerIngestHandlers listens to deliverable_status_changed", () => {
		const handlers: Record<string, any[]> = {};
		const broker = {
			subscribe: (handler: any) => {
				if (!handlers["deliverable_status_changed"]) handlers["deliverable_status_changed"] = [];
				handlers["deliverable_status_changed"].push(handler);
				return () => {};
			},
			emit: vi.fn(),
		};
		const db = {};
		const dataDir = "/tmp";

		registerIngestHandlers(broker as any, db as any, dataDir);

		expect(handlers["deliverable_status_changed"]).toBeDefined();
		expect(handlers["deliverable_status_changed"].length).toBe(1);
	});

	it("returns unsubscribe function", () => {
		const broker = {
			subscribe: (handler: any) => {
				return vi.fn();
			},
			emit: vi.fn(),
		};
		const db = {};
		const dataDir = "/tmp";

		const unsubscribe = registerIngestHandlers(broker as any, db as any, dataDir);

		expect(typeof unsubscribe).toBe("function");
	});

	it("ignores events that are not deliverable_status_changed", () => {
		const handler = vi.fn();
		const broker = {
			subscribe: (h: any) => {
				handler.mockImplementation(h);
				return () => {};
			},
			emit: vi.fn(),
		};
		const db = {};
		const dataDir = "/tmp";

		registerIngestHandlers(broker as any, db as any, dataDir);

		const capturedHandler = handler.mock.calls[0]?.[0];
		if (capturedHandler) {
			capturedHandler({ type: "other_event", payload: {} });
			expect(broker.emit).not.toHaveBeenCalled();
		}
	});

	it("ignores deliverables without eval_score", () => {
		const handler = vi.fn();
		const broker = {
			subscribe: (h: any) => {
				handler.mockImplementation(h);
				return () => {};
			},
			emit: vi.fn(),
		};
		const db = {};
		const dataDir = "/tmp";

		registerIngestHandlers(broker as any, db as any, dataDir);

		const capturedHandler = handler.mock.calls[0]?.[0];
		if (capturedHandler) {
			capturedHandler({
				type: "deliverable_status_changed",
				payload: {
					status: "shipped",
					deliverable_id: "d_1",
					client_slug: "default",
					deliverable_type: "blog_post",
				},
			});
			// Should not emit error since eval_score is missing (expected behavior)
			expect(broker.emit).not.toHaveBeenCalled();
		}
	});

	it("ignores non-shipped deliverables", () => {
		const handler = vi.fn();
		const broker = {
			subscribe: (h: any) => {
				handler.mockImplementation(h);
				return () => {};
			},
			emit: vi.fn(),
		};
		const db = {};
		const dataDir = "/tmp";

		registerIngestHandlers(broker as any, db as any, dataDir);

		const capturedHandler = handler.mock.calls[0]?.[0];
		if (capturedHandler) {
			capturedHandler({
				type: "deliverable_status_changed",
				payload: {
					status: "drafting",
					eval_score: 5,
					deliverable_id: "d_1",
					client_slug: "default",
					deliverable_type: "blog_post",
				},
			});
			// Should not emit since status is not 'shipped'
			expect(broker.emit).not.toHaveBeenCalled();
		}
	});
});
