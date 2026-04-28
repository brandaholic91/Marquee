import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetApiKey, mockRefreshToken } = vi.hoisted(() => ({
  mockGetApiKey: vi.fn(),
  mockRefreshToken: vi.fn(),
}));

vi.mock("@mariozechner/pi-ai/oauth", () => ({
  refreshOpenAICodexToken: mockRefreshToken,
  openaiCodexOAuthProvider: { getApiKey: mockGetApiKey },
}));

import { AuthManager } from "./auth.js";

function writeAuthFile(dir: string, creds: Record<string, unknown>): string {
  const path = join(dir, "auth.json");
  writeFileSync(path, JSON.stringify({ "openai-codex": creds }), "utf8");
  return path;
}

describe("AuthManager", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "auth-test-"));
    mockGetApiKey.mockReturnValue("Bearer cached-token");
    mockRefreshToken.mockResolvedValue({
      refresh: "new-refresh",
      access: "new-access",
      expires: Date.now() + 3600000,
    });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("throws when auth file does not exist", async () => {
    const manager = new AuthManager(join(dir, "missing.json"));
    await expect(manager.start()).rejects.toThrow("Run login first");
  });

  it("caches api key when token is valid", async () => {
    const path = writeAuthFile(dir, {
      refresh: "r1", access: "a1", expires: Date.now() + 3600000,
    });
    const manager = new AuthManager(path);
    await manager.start();
    manager.stop();
    expect(manager.getApiKey("openai-codex")).toBe("Bearer cached-token");
    expect(mockRefreshToken).not.toHaveBeenCalled();
  });

  it("refreshes token when expired at startup", async () => {
    const path = writeAuthFile(dir, {
      refresh: "old-refresh", access: "old-access", expires: Date.now() - 1000,
    });
    const manager = new AuthManager(path);
    await manager.start();
    manager.stop();
    expect(mockRefreshToken).toHaveBeenCalledWith("old-refresh");
    expect(manager.getApiKey("openai-codex")).toBe("Bearer cached-token");
  });

  it("returns undefined for other providers", async () => {
    const path = writeAuthFile(dir, {
      refresh: "r1", access: "a1", expires: Date.now() + 3600000,
    });
    const manager = new AuthManager(path);
    await manager.start();
    manager.stop();
    expect(manager.getApiKey("openrouter")).toBeUndefined();
    expect(manager.getApiKey("opencode-go")).toBeUndefined();
  });
});
