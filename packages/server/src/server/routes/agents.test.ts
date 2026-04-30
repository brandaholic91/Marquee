import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentsRoutes } from "./agents.js";

let app: FastifyInstance;
let dataDir: string;

beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "marquee-agents-routes-"));
  app = Fastify();
  await app.register(agentsRoutes, { dataDir });
});

afterEach(async () => {
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
});

describe("GET /api/agents", () => {
  it("returns an array of 7 agent summaries", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agents" });
    expect(res.statusCode).toBe(200);
    const body = res.json<unknown[]>();
    expect(body).toHaveLength(7);
  });

  it("each entry has role, name, lifecycle, model, tools, skillCount, description", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agents" });
    const body = res.json<Record<string, unknown>[]>();
    const director = body.find((a) => a.role === "director");
    expect(director).toBeDefined();
    expect(director!.lifecycle).toBe("warm");
    expect(typeof director!.model).toBe("string");
    expect(Array.isArray(director!.tools)).toBe(true);
    expect(typeof director!.skillCount).toBe("number");
  });

  it("each entry has thinkingLevel, name, and description fields", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agents" });
    const body = res.json<Record<string, unknown>[]>();
    const director = body.find((a) => a.role === "director");
    expect(director).toBeDefined();
    expect(typeof director!.thinkingLevel).toBe("string");
    expect(typeof director!.name).toBe("string");
    expect(typeof director!.description).toBe("string");
  });
});

describe("GET /api/agents/:role/identity", () => {
  it("returns empty body when identity.md missing", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agents/director/identity" });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ body: string }>().body).toBe("");
  });

  it("returns body when identity.md exists", async () => {
    mkdirSync(join(dataDir, "agents/director"), { recursive: true });
    writeFileSync(join(dataDir, "agents/director/identity.md"), "You are the Director.");
    const res = await app.inject({ method: "GET", url: "/api/agents/director/identity" });
    expect(res.json<{ body: string }>().body).toContain("You are the Director.");
  });

  it("returns 404 for unknown role", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agents/ghost-role/identity" });
    expect(res.statusCode).toBe(404);
  });
});

describe("PUT /api/agents/:role/identity", () => {
  it("saves identity and returns ok", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/agents/director/identity",
      payload: { body: "New identity text." },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ ok: boolean }>().ok).toBe(true);

    const get = await app.inject({ method: "GET", url: "/api/agents/director/identity" });
    expect(get.json<{ body: string }>().body).toContain("New identity text.");
  });

  it("returns 404 for unknown role", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/agents/ghost-role/identity",
      payload: { body: "Should not save." },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /api/agents/:role/config", () => {
  it("returns empty object when config.json missing", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agents/director/config" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({});
  });

  it("returns 404 for unknown role", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agents/ghost-role/config" });
    expect(res.statusCode).toBe(404);
  });
});

describe("PUT /api/agents/:role/config", () => {
  it("saves and returns ok", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/agents/director/config",
      payload: { model: "gpt-5.4", thinking_level: "low" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ ok: boolean }>().ok).toBe(true);

    const get = await app.inject({ method: "GET", url: "/api/agents/director/config" });
    expect(get.json<{ model: string; thinking_level: string }>()).toEqual({
      model: "gpt-5.4",
      thinking_level: "low",
    });
  });

  it("returns 404 for unknown role", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/agents/ghost-role/config",
      payload: { model: "gpt-5.4" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("partial update merges with existing config, not overwrite", async () => {
    // First, save a config with model
    await app.inject({
      method: "PUT",
      url: "/api/agents/director/config",
      payload: { model: "gpt-5.4" },
    });

    // Then, update with only thinking_level
    await app.inject({
      method: "PUT",
      url: "/api/agents/director/config",
      payload: { thinking_level: "low" },
    });

    // Both should be present in the merged result
    const get = await app.inject({ method: "GET", url: "/api/agents/director/config" });
    expect(get.json()).toEqual({
      model: "gpt-5.4",
      thinking_level: "low",
    });
  });

  it("empty model string is removed from config", async () => {
    // Save a config with model
    await app.inject({
      method: "PUT",
      url: "/api/agents/director/config",
      payload: { model: "gpt-5.4" },
    });

    // Clear it by sending empty string
    await app.inject({
      method: "PUT",
      url: "/api/agents/director/config",
      payload: { model: "" },
    });

    // Model key should be gone
    const get = await app.inject({ method: "GET", url: "/api/agents/director/config" });
    expect(get.json()).toEqual({});
  });

  it("thinking_level 'off' is removed from config", async () => {
    // Save a config with thinking_level
    await app.inject({
      method: "PUT",
      url: "/api/agents/director/config",
      payload: { thinking_level: "low" },
    });

    // Set it to "off"
    await app.inject({
      method: "PUT",
      url: "/api/agents/director/config",
      payload: { thinking_level: "off" },
    });

    // thinking_level key should be gone
    const get = await app.inject({ method: "GET", url: "/api/agents/director/config" });
    expect(get.json()).toEqual({});
  });
});

describe("GET /api/agents/:role/skills", () => {
  it("returns empty array when no skills exist", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agents/director/skills" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("returns frontmatter-only list when skills exist", async () => {
    mkdirSync(join(dataDir, "skills/director"), { recursive: true });
    writeFileSync(
      join(dataDir, "skills/director/brief_parser.md"),
      "---\nname: brief_parser\ndescription: Parses briefs\n---\n\nSECRET BODY",
    );
    const res = await app.inject({ method: "GET", url: "/api/agents/director/skills" });
    const body = res.json<{ name: string; description: string }[]>();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("brief_parser");
    expect(body[0].description).toBe("Parses briefs");
    expect(JSON.stringify(body)).not.toContain("SECRET BODY");
  });

  it("returns 404 for unknown role", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agents/ghost/skills" });
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /api/agents/:role/skills/:name", () => {
  it("returns 404 for unknown skill", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agents/director/skills/ghost" });
    expect(res.statusCode).toBe(404);
  });

  it("returns name, description, body for existing skill", async () => {
    mkdirSync(join(dataDir, "skills/director"), { recursive: true });
    writeFileSync(
      join(dataDir, "skills/director/brief_parser.md"),
      "---\nname: brief_parser\ndescription: Parses briefs\n---\n\nStep 1: parse.",
    );
    const res = await app.inject({ method: "GET", url: "/api/agents/director/skills/brief_parser" });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ name: string; description: string; body: string }>();
    expect(body.name).toBe("brief_parser");
    expect(body.description).toBe("Parses briefs");
    expect(body.body).toContain("Step 1: parse.");
  });
});

describe("PUT /api/agents/:role/skills/:name", () => {
  it("creates or updates a skill", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/agents/director/skills/my_skill",
      payload: { description: "Does something", body: "Step 1: do it." },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ ok: boolean }>().ok).toBe(true);

    const get = await app.inject({ method: "GET", url: "/api/agents/director/skills/my_skill" });
    expect(get.json<{ body: string }>().body).toContain("Step 1: do it.");
  });
});

describe("POST /api/agents/:role/skills", () => {
  it("creates a new skill and returns ok", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/agents/director/skills",
      payload: { name: "new_skill", description: "A new skill", body: "Do something new." },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ ok: boolean }>().ok).toBe(true);

    const list = await app.inject({ method: "GET", url: "/api/agents/director/skills" });
    const names = list.json<{ name: string }[]>().map((s) => s.name);
    expect(names).toContain("new_skill");
  });

  it("returns 400 when name or description missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/agents/director/skills",
      payload: { body: "no name or description" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("DELETE /api/agents/:role/skills/:name", () => {
  it("deletes an existing skill", async () => {
    mkdirSync(join(dataDir, "skills/director"), { recursive: true });
    writeFileSync(
      join(dataDir, "skills/director/to_delete.md"),
      "---\nname: to_delete\ndescription: d\n---\nbody",
    );
    const res = await app.inject({
      method: "DELETE",
      url: "/api/agents/director/skills/to_delete",
    });
    expect(res.statusCode).toBe(200);

    const list = await app.inject({ method: "GET", url: "/api/agents/director/skills" });
    expect(list.json<unknown[]>()).toHaveLength(0);
  });
});
