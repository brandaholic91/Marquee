import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { spawnIngestAgent, runIngestAgent } from "./agent.js";
import { readWikiPage, writeWikiPage } from "../memory/wiki.js";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import os from "node:os";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";

// Mock the agent core
vi.mock("@mariozechner/pi-agent-core", () => ({
	Agent: class FakeAgent {
		constructor(public opts: any) {}
		async prompt(text: string | any) {
			// Simulate agent execution with a tool call
			// In a real scenario, this would trigger tool_execution events
			return;
		}
		subscribe(fn: any) {
			return () => {};
		}
	},
}));

// Mock the tools - these will record calls
const mockReadWikiCalls: any[] = [];
const mockProposeWikiCalls: any[] = [];

vi.mock("../tools/read-wiki.js", () => ({
	makeReadWikiTool: () => ({
		name: "read_wiki",
		description: "Read wiki pages",
		inputSchema: { type: "object", properties: {} },
		execute: async (input: any) => {
			mockReadWikiCalls.push(input);
			return "# Brand Voice Patterns\n\n## LinkedIn\n- Use conversational tone";
		},
	}),
}));

vi.mock("../tools/propose-wiki-update.js", () => ({
	makeProposeWikiUpdateTool: (opts: any) => ({
		name: "propose_wiki_update",
		description: "Propose wiki update",
		inputSchema: { type: "object", properties: {} },
		execute: async (input: any) => {
			mockProposeWikiCalls.push(input);
			// Simulate the tool creating a proposal in the DB
			const proposalId = `prop-${Date.now()}-${Math.random()}`;
			if (opts.db && opts.clientSlug) {
				await opts.db.insert(schema.wikiProposals).values({
					id: proposalId,
					clientSlug: opts.clientSlug,
					wikiPage: input.page || "brand-voice-patterns.md",
					newContent: input.new_content || "",
					reason: input.reason || "Ingest proposal",
					agentSessionId: opts.agentSessionId,
					createdAt: Date.now(),
					approvedAt: null,
					rejectedAt: null,
					approvedBy: null,
					rejectionReason: null,
				});
			}
			return { proposal_id: proposalId };
		},
	}),
}));

vi.mock("../tools/read-memory.js", () => ({
	makeReadMemoryTool: () => ({
		name: "read_memory",
		description: "Read memory",
		inputSchema: { type: "object", properties: {} },
		execute: async () => "Brand: GrowthFrame. Target: B2B SaaS.",
	}),
}));

vi.mock("../providers/auth.js", () => ({
	AuthManager: class FakeAuthManager {
		getApiKey(provider: string) {
			return undefined;
		}
	},
}));

describe("Ingest E2E Flow", () => {
	let tempDir: string;
	let db: any;
	let broker: any;

	beforeEach(async () => {
		tempDir = join(os.tmpdir(), `ingest-e2e-${Date.now()}`);
		await mkdir(join(tempDir, "wiki", "clients", "test"), { recursive: true });

		// Initialize in-memory SQLite database
		const sqlite = new Database(":memory:");
		db = drizzle(sqlite, { schema });

		// Create necessary tables
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
			CREATE TABLE IF NOT EXISTS wiki_proposals (
				id TEXT PRIMARY KEY,
				client_slug TEXT NOT NULL,
				wiki_page TEXT NOT NULL,
				new_content TEXT NOT NULL,
				reason TEXT NOT NULL,
				agent_session_id TEXT,
				created_at INTEGER NOT NULL,
				approved_at INTEGER,
				rejected_at INTEGER,
				approved_by TEXT,
				rejection_reason TEXT,
				FOREIGN KEY (client_slug) REFERENCES clients(slug),
				FOREIGN KEY (agent_session_id) REFERENCES agent_sessions(id)
			);
			CREATE INDEX IF NOT EXISTS idx_wiki_proposals_client_slug ON wiki_proposals(client_slug);
			CREATE INDEX IF NOT EXISTS idx_wiki_proposals_created_at ON wiki_proposals(created_at);
		`);

		// Insert test client
		await db.insert(schema.clients).values({
			slug: "test",
			name: "Test Client",
			createdAt: Date.now(),
		});

		// Setup broker
		broker = { emit: vi.fn() };

		// Reset mock calls
		mockReadWikiCalls.length = 0;
		mockProposeWikiCalls.length = 0;
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	it("spawns ingest agent with correct session", async () => {
		const { agent, session } = await spawnIngestAgent({
			db,
			broker,
			dataDir: tempDir,
			clientSlug: "test",
			deliverableId: "del-123",
			evalScore: 5,
			evalSummary: "Excellent hook",
			deliverableType: "blog_post",
			briefTitle: "SEO Guide",
		});

		expect(agent).toBeDefined();
		expect(session.id).toBeTruthy();
		expect(session.lifecycle).toBe("transient");
	});

	it("runs ingest agent with user message prompt", async () => {
		const { agent, session } = await spawnIngestAgent({
			db,
			broker,
			dataDir: tempDir,
			clientSlug: "test",
			deliverableId: "del-456",
			evalScore: 4,
			evalSummary: "Good pattern with improvements",
			deliverableType: "email",
			briefTitle: "Test Email",
		});

		const promptSpy = vi.spyOn(agent, "prompt");

		await runIngestAgent(agent, {
			db,
			broker,
			dataDir: tempDir,
			clientSlug: "test",
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

	it("agent has access to read_wiki, propose_wiki_update, and read_memory tools", async () => {
		const { agent } = await spawnIngestAgent({
			db,
			broker,
			dataDir: tempDir,
			clientSlug: "test",
			deliverableId: "del-789",
			evalScore: 5,
			evalSummary: "Excellent pattern",
			deliverableType: "blog_post",
			briefTitle: "Content Strategy",
		});

		const tools = (agent as any).opts.initialState.tools;
		expect(tools).toBeDefined();
		expect(tools.length).toBeGreaterThan(0);

		const toolNames = tools.map((t: any) => t.name);
		expect(toolNames).toContain("read_wiki");
		expect(toolNames).toContain("propose_wiki_update");
		expect(toolNames).toContain("read_memory");
	});

	it("ingest agent proposes wiki update on 5/5 eval score", async () => {
		// Setup: seed wiki
		await writeWikiPage(
			tempDir,
			"clients/test/brand-voice-patterns.md",
			"# Patterns\n\n## LinkedIn\n"
		);

		const { agent, session } = await spawnIngestAgent({
			db,
			broker,
			dataDir: tempDir,
			clientSlug: "test",
			deliverableId: "del-1000",
			evalScore: 5,
			evalSummary: "Excellent hook with strong engagement",
			deliverableType: "blog_post",
			briefTitle: "SEO Guide",
		});

		// Simulate tool execution for propose_wiki_update
		const tools = (agent as any).opts.initialState.tools;
		const proposeWikiUpdateTool = tools.find((t: any) => t.name === "propose_wiki_update");

		expect(proposeWikiUpdateTool).toBeDefined();

		// Simulate tool call
		if (proposeWikiUpdateTool) {
			const result = await proposeWikiUpdateTool.execute(
				"test-tool-call-1",
				{
					page: "brand-voice-patterns.md",
					new_content: "# Patterns\n\n## LinkedIn\n- Hook: Strong opening question\n",
					reason: "Excellent eval: Strong engagement pattern observed",
				}
			);

			expect(result.details).toHaveProperty("proposal_id");
		}

		// Verify proposal was created in database
		const proposals = await db
			.select()
			.from(schema.wikiProposals)
			.where(eq(schema.wikiProposals.clientSlug, "test"));

		expect(proposals.length).toBeGreaterThan(0);
		expect(proposals[0].wikiPage).toBe("brand-voice-patterns.md");
		expect(proposals[0].reason).toContain("Excellent");
	});

	it("ingest agent records session in database", async () => {
		const { session } = await spawnIngestAgent({
			db,
			broker,
			dataDir: tempDir,
			clientSlug: "test",
			deliverableId: "del-2000",
			evalScore: 3,
			evalSummary: "Average pattern",
			deliverableType: "social_post",
			briefTitle: "Social Campaign",
		});

		const sessions = await db
			.select()
			.from(schema.agentSessions)
			.where(eq(schema.agentSessions.id, session.id));

		expect(sessions.length).toBe(1);
		expect(sessions[0].clientSlug).toBe("test");
		expect(sessions[0].agentSlug).toBe("ingest");
		expect(sessions[0].lifecycle).toBe("transient");
		expect(sessions[0].startedAt).toBeTruthy();
	});

	it("ingest agent includes system prompt with deliverable context", async () => {
		const { agent } = await spawnIngestAgent({
			db,
			broker,
			dataDir: tempDir,
			clientSlug: "test",
			deliverableId: "del-3000",
			evalScore: 5,
			evalSummary: "Perfect execution",
			deliverableType: "ad_copy",
			briefTitle: "Product Launch Ad",
		});

		const systemPrompt = (agent as any).opts.initialState.systemPrompt;
		expect(systemPrompt).toContain("ad_copy");
		expect(systemPrompt).toContain("Product Launch Ad");
		expect(systemPrompt).toContain("5/5");
		expect(systemPrompt).toContain("Perfect execution");
		expect(systemPrompt).toContain("read_wiki");
		expect(systemPrompt).toContain("propose_wiki_update");
	});

	it("full e2e flow: deliverable ships -> ingest agent spawns -> reads wiki -> proposes update", async () => {
		// 1. Setup initial wiki content
		await writeWikiPage(
			tempDir,
			"clients/test/seo-learnings.md",
			"# SEO Learnings\n\n## Keywords\n"
		);

		// 2. Spawn ingest agent (triggered by deliverable shipped event)
		const { agent, session } = await spawnIngestAgent({
			db,
			broker,
			dataDir: tempDir,
			clientSlug: "test",
			deliverableId: "del-4000",
			evalScore: 5,
			evalSummary: "Excellent keyword research and implementation",
			deliverableType: "blog_post",
			briefTitle: "Complete SEO Guide 2026",
		});

		expect(agent).toBeDefined();
		expect(session.id).toBeTruthy();

		// 3. Verify session was recorded
		const recordedSessions = await db
			.select()
			.from(schema.agentSessions)
			.where(eq(schema.agentSessions.id, session.id));

		expect(recordedSessions).toHaveLength(1);
		expect(recordedSessions[0].agentSlug).toBe("ingest");

		// 4. Simulate agent reading wiki (mocked to return brand voice patterns)
		const tools = (agent as any).opts.initialState.tools;
		const readWikiTool = tools.find((t: any) => t.name === "read_wiki");
		const wikiContent = await readWikiTool.execute("test-call-1", { page: "seo-learnings.md" });

		expect(wikiContent.content).toBeDefined();
		// Mocked tool returns fixed content, verify the tool was called
		expect(wikiContent.content[0].text).toContain("Brand Voice Patterns");
		// Verify the mock recorded the call
		expect(mockReadWikiCalls.length).toBeGreaterThan(0);

		// 5. Simulate agent proposing update (high eval score triggers update proposal)
		const proposeWikiUpdateTool = tools.find((t: any) => t.name === "propose_wiki_update");
		const proposalResult = await proposeWikiUpdateTool.execute("test-call-2", {
			page: "seo-learnings.md",
			new_content: "# SEO Learnings\n\n## Keywords\n- Long-tail technical keywords show 3x conversion rate\n",
			reason: "Excellent keyword research in blog post (5/5 eval)",
		});

		expect(proposalResult.details).toHaveProperty("proposal_id");

		// 6. Verify proposal was created in database
		const proposals = await db
			.select()
			.from(schema.wikiProposals)
			.where(eq(schema.wikiProposals.clientSlug, "test"));

		expect(proposals.length).toBeGreaterThan(0);
		const proposal = proposals.find((p) => p.reason.includes("keyword research"));
		expect(proposal).toBeDefined();
		expect(proposal?.wikiPage).toBe("seo-learnings.md");
		expect(proposal?.agentSessionId).toBe(session.id);
		expect(proposal?.approvedAt).toBeNull(); // Not approved yet
	});
});
