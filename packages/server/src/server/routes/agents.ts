import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { loadAgentConfig, buildBehaviorBlock } from "../../agents/config.js";

const VALID_ROLES = new Set([
  "director", "content-lead", "distribution-lead", "insights-lead",
  "copywriter", "social-manager", "seo-analyst", "eval-judge",
  "paid-specialist", "repurposer", "analytics-analyst",
]);

export function registerAgentRoutes(app: FastifyInstance, opts: ServerOpts) {
  app.get<{ Params: { role: string } }>("/api/agents/:role/config", async (req, reply) => {
    if (!VALID_ROLES.has(req.params.role)) return reply.code(404).send({ error: "unknown role" });
    const config = loadAgentConfig(opts.dataDir, req.params.role);
    if (!config) return null;
    return { config, behaviorBlock: buildBehaviorBlock(config) };
  });

  app.put<{ Params: { role: string }; Body: Record<string, unknown> }>(
    "/api/agents/:role/config",
    async (req, reply) => {
      if (!VALID_ROLES.has(req.params.role)) return reply.code(404).send({ error: "unknown role" });
      const dir = join(opts.dataDir, "agents", req.params.role);
      mkdirSync(dir, { recursive: true });
      const content = matter.stringify("", req.body);
      writeFileSync(join(dir, "config.md"), content, "utf8");
      const warmRoles = opts.router.getWarmRoles();
      if (warmRoles.includes(req.params.role)) {
        opts.router.restartWarmAgent(req.params.role);
      }
      return { ok: true };
    },
  );
}
