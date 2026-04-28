import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { openaiCodexOAuthProvider, refreshOpenAICodexToken } from "@mariozechner/pi-ai";
import type { OAuthCredentials } from "@mariozechner/pi-ai";

type AuthFile = Record<string, OAuthCredentials>;

export class AuthManager {
  private cachedApiKey: string | null = null;
  private credentials: OAuthCredentials | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private authFilePath: string) {}

  async start(): Promise<void> {
    if (!existsSync(this.authFilePath)) {
      throw new Error(
        `openai-subscription mode requires auth credentials. ` +
        `Run login first and ensure auth file exists at ${this.authFilePath}`,
      );
    }
    const file = JSON.parse(readFileSync(this.authFilePath, "utf8")) as AuthFile;
    let credentials = file["openai-codex"];
    if (!credentials) {
      throw new Error(`No openai-codex credentials found in ${this.authFilePath}`);
    }
    if (credentials.expires < Date.now()) {
      credentials = await refreshOpenAICodexToken(credentials.refresh);
      file["openai-codex"] = credentials;
      writeFileSync(this.authFilePath, JSON.stringify(file, null, 2), "utf8");
    }
    this.credentials = credentials;
    this.cachedApiKey = openaiCodexOAuthProvider.getApiKey(credentials);
    this.refreshTimer = setInterval(() => { void this.checkAndRefresh(); }, 30 * 60 * 1000);
  }

  private async checkAndRefresh(): Promise<void> {
    if (!this.credentials) return;
    if (this.credentials.expires - Date.now() < 5 * 60 * 1000) {
      try {
        const newCreds = await refreshOpenAICodexToken(this.credentials.refresh);
        const file = JSON.parse(readFileSync(this.authFilePath, "utf8")) as AuthFile;
        file["openai-codex"] = newCreds;
        writeFileSync(this.authFilePath, JSON.stringify(file, null, 2), "utf8");
        this.credentials = newCreds;
        this.cachedApiKey = openaiCodexOAuthProvider.getApiKey(newCreds);
      } catch (e) {
        console.error("[AuthManager] token refresh failed:", e);
      }
    }
  }

  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  getApiKey(provider: string): string | undefined {
    if (provider === "openai-codex") return this.cachedApiKey ?? undefined;
    return undefined;
  }
}
