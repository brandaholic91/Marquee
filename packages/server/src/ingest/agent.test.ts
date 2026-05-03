import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { spawnIngestAgent, runIngestAgent } from "./agent.js";
import * as schema from "../db/schema.js";
import { join } from "node:path";
import os from "node:os";
import { mkdir } from "node:fs/promises";

// Mock the agent core
vi.mock("@mariozechner/pi-agent-core", () => ({
	Agent: class FakeAgent {
		constructor(public opts: any) {}
		async prompt(text: string | any) {
			return;
		}
		subscribe(fn: any) {
			return () => {};
		}
	},
}));

// Mock the tools
vi.mock("../tools/read-wiki.js", () => ({
	makeReadWikiTool: () => ({
		name: "read_wiki",
		description: "Read wiki pages",
		inputSchema: { type: "object", properties: {} },
		execute: async () => "wiki content",
	}),
}));

vi.mock("../tools/propose-wiki-update.js", () => ({
	makeProposeWikiUpdateTool: () => ({
		name: "propose_wiki_update",
		description: "Propose wiki update",
		inputSchema: { type: "object", properties: {} },
		execute: async () => "proposal recorded",
	}),
}));

vi.mock("../tools/read-memory.js", () => ({
	makeReadMemoryTool: () => ({
		name: "read_memory",
		description: "Read memory",
		inputSchema: { type: "object", properties: {} },
		execute: async () => "memory content",
	}),
}));

// Mock auth manager
vi.mock("../providers/auth.js", () => ({
	AuthManager: class FakeAuthManager {
		getApiKey(provider: string) {
			return undefined;
		}
	},
}));

describe("ingest agent", () => {
	let tempDir: string;
	let db: any;

	beforeEach(async () => {
		tempDir = join(os.tmpdir(), `ingest-test-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		const sqlite = new Database(":memory:");
		db = drizzle(sqlite, { schema });

		// Manually create the minimal tables needed for testing
		sqlite.exec(`
			CREATE TABLE IF NOT EXISTS clients (
				slug TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				created_at INTEGER NOT NULL
			);
			CREATE TABLE IF NOT EXISTS agent_sessions (
				id TEXT PRIMARY KEY,
				client_slug TEXT NOT NULL,
				agent_slug TEXT NOT NULL,
				lifecycle TEXT NOT NULL,
				parent_delegation_id TEXT,
				started_at INTEGER NOT NULL,
				ended_at INTEGER,
				FOREIGN KEY (client_slug) REFERENCES clients(slug)
			);
		`);

		await db.insert(schema.clients).values({ slug: "test-client", name: "Test", createdAt: Date.now() });
	});

	it("spawnIngestAgent returns agent and session", async () => {
		const broker = { emit: (e: any) => {} };
		const result = await spawnIngestAgent({
			db,
			broker,
			dataDir: tempDir,
			clientSlug: "test-client",
			deliverableId: "del-123",
			evalScore: 5,
			evalSummary: "Excellent pattern",
			deliverableType: "blog_post",
			briefTitle: "Test Blog",
		});

		expect(result.agent).toBeDefined();
		expect(result.session.id).toBeTruthy();
		expect(result.session.lifecycle).toBe("transient");
	});

	it("runIngestAgent executes with user message", async () => {
		const broker = { emit: (e: any) => {} };
		const spawnResult = await spawnIngestAgent({
			db,
			broker,
			dataDir: tempDir,
			clientSlug: "test-client",
			deliverableId: "del-456",
			evalScore: 4,
			evalSummary: "Good pattern with improvements",
			deliverableType: "email",
			briefTitle: "Test Email",
		});

		const promptSpy = vi.spyOn(spawnResult.agent, "prompt");

		await runIngestAgent(spawnResult.agent, {
			db,
			broker,
			dataDir: tempDir,
			clientSlug: "test-client",
			deliverableId: "del-456",
			evalScore: 4,
			evalSummary: "Good pattern with improvements",
			deliverableType: "email",
			briefTitle: "Test Email",
		});

		expect(promptSpy).toHaveBeenCalledOnce();
		const message = promptSpy.mock.calls[0]?.[0] as string;
		expect(message).toContain("email");
		expect(message).toContain("Test Email");
		expect(message).toContain("4/5");
	});

	it("runIngestAgent handles execution errors gracefully", async () => {
		const broker = { emit: (e: any) => {} };
		const spawnResult = await spawnIngestAgent({
			db,
			broker,
			dataDir: tempDir,
			clientSlug: "test-client",
			deliverableId: "del-789",
			evalScore: 3,
			evalSummary: "Average pattern",
			deliverableType: "social_post",
			briefTitle: "Test Social",
		});

		const testError = new Error("Agent execution failed");
		const promptSpy = vi.spyOn(spawnResult.agent, "prompt");
		promptSpy.mockRejectedValue(testError);

		await expect(
			runIngestAgent(spawnResult.agent, {
				db,
				broker,
				dataDir: tempDir,
				clientSlug: "test-client",
				deliverableId: "del-789",
				evalScore: 3,
				evalSummary: "Average pattern",
				deliverableType: "social_post",
				briefTitle: "Test Social",
			})
		).rejects.toThrow("Agent execution failed");
	});
});
