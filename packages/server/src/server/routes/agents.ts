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
import {
	listSkillsForRole,
	loadSkillBody,
	saveSkill,
	deleteSkill,
} from "../../skills/loader.js";

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

	// GET /api/agents/:role/skills
	app.get<{ Params: { role: string } }>("/api/agents/:role/skills", async (req, reply) => {
		const { role } = req.params;
		if (!isValidRole(role)) return reply.code(404).send({ error: "unknown role" });
		return listSkillsForRole(dataDir, role);
	});

	// GET /api/agents/:role/skills/:name
	app.get<{ Params: { role: string; name: string } }>(
		"/api/agents/:role/skills/:name",
		async (req, reply) => {
			const { role, name } = req.params;
			if (!isValidRole(role)) return reply.code(404).send({ error: "unknown role" });
			const metas = listSkillsForRole(dataDir, role);
			const meta = metas.find((s) => s.name === name);
			if (!meta) return reply.code(404).send({ error: "skill not found" });
			const body = loadSkillBody(dataDir, role, name) ?? "";
			return { ...meta, body };
		},
	);

	// PUT /api/agents/:role/skills/:name
	app.put<{ Params: { role: string; name: string }; Body: { description: string; body: string } }>(
		"/api/agents/:role/skills/:name",
		async (req, reply) => {
			const { role, name } = req.params;
			if (!isValidRole(role)) return reply.code(404).send({ error: "unknown role" });
			saveSkill(dataDir, role, name, req.body.description ?? "", req.body.body ?? "");
			return reply.send({ ok: true });
		},
	);

	// POST /api/agents/:role/skills
	app.post<{ Params: { role: string }; Body: { name: string; description: string; body: string } }>(
		"/api/agents/:role/skills",
		async (req, reply) => {
			const { role } = req.params;
			if (!isValidRole(role)) return reply.code(404).send({ error: "unknown role" });
			const { name, description, body } = req.body;
			if (!name || !description) return reply.code(400).send({ error: "name and description required" });
			saveSkill(dataDir, role, name, description, body ?? "");
			return reply.send({ ok: true });
		},
	);

	// DELETE /api/agents/:role/skills/:name
	app.delete<{ Params: { role: string; name: string } }>(
		"/api/agents/:role/skills/:name",
		async (req, reply) => {
			const { role, name } = req.params;
			if (!isValidRole(role)) return reply.code(404).send({ error: "unknown role" });
			deleteSkill(dataDir, role, name);
			return reply.send({ ok: true });
		},
	);
};
