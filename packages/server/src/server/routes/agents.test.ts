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
});

describe("GET /api/agents/:role/config", () => {
  it("returns empty object when config.json missing", async () => {
    const res = await app.inject({ method: "GET", url: "/api/agents/director/config" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({});
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
});
