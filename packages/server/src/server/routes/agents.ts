import type { FastifyPluginAsync } from "fastify";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { ROLE_CONFIGS, ROLE_DISPLAY_NAMES, type RoleSlug } from "../../agents/config.js";
import { ROLE_MODEL } from "../../providers/index.js";
import {
	loadAgentIdentity,
	saveAgentIdentity,
	loadAgentConfig,
	saveAgentConfig,
	loadAgentDescription,
} from "../../agents/loader.js";

export interface AgentsRoutesOpts {
	dataDir: string;
}

function isValidRole(role: string): role is RoleSlug {
	return role in ROLE_CONFIGS;
}

function skillCount(dataDir: string, role: string): number {
	try {
		return readdirSync(join(dataDir, "skills", role)).filter((f) => f.endsWith(".md")).length;
	} catch {
		return 0;
	}
}

export const agentsRoutes: FastifyPluginAsync<AgentsRoutesOpts> = async (app, { dataDir }) => {
	// GET /api/agents — list all agents
	app.get("/api/agents", async () =>
		Object.entries(ROLE_CONFIGS).map(([role, cfg]) => {
			const config = loadAgentConfig(dataDir, role);
			return {
				role,
				name: ROLE_DISPLAY_NAMES[role as RoleSlug] ?? role,
				lifecycle: cfg.lifecycle,
				model: config.model ?? ROLE_MODEL[role] ?? "gpt-5.4-mini",
				thinkingLevel: config.thinking_level ?? "off",
				tools: cfg.tools,
				skillCount: skillCount(dataDir, role),
				description: loadAgentDescription(dataDir, role),
			};
		}),
	);

	// GET /api/agents/:role/identity
	app.get<{ Params: { role: string } }>("/api/agents/:role/identity", async (req, reply) => {
		const { role } = req.params;
		if (!isValidRole(role)) return reply.code(404).send({ error: "unknown role" });
		return { body: loadAgentIdentity(dataDir, role) };
	});

	// PUT /api/agents/:role/identity
	app.put<{ Params: { role: string }; Body: { body: string } }>(
		"/api/agents/:role/identity",
		async (req, reply) => {
			const { role } = req.params;
			if (!isValidRole(role)) return reply.code(404).send({ error: "unknown role" });
			saveAgentIdentity(dataDir, role, req.body.body ?? "");
			return reply.send({ ok: true });
		},
	);

	// GET /api/agents/:role/config
	app.get<{ Params: { role: string } }>("/api/agents/:role/config", async (req, reply) => {
		const { role } = req.params;
		if (!isValidRole(role)) return reply.code(404).send({ error: "unknown role" });
		return loadAgentConfig(dataDir, role);
	});

	// PUT /api/agents/:role/config
	app.put<{ Params: { role: string }; Body: { model?: string; thinking_level?: string } }>(
		"/api/agents/:role/config",
		async (req, reply) => {
			const { role } = req.params;
			if (!isValidRole(role)) return reply.code(404).send({ error: "unknown role" });
			const existing = loadAgentConfig(dataDir, role);
			const updated = { ...existing, ...req.body };
			if (!updated.model) delete updated.model;
			if (!updated.thinking_level || updated.thinking_level === "off")
				delete updated.thinking_level;
			saveAgentConfig(dataDir, role, updated);
			return reply.send({ ok: true });
		},
	);

	// Skill routes added in Task 7
};
