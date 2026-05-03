import { getModel } from "@mariozechner/pi-ai";

export const ROLE_MODEL: Record<string, string> = {
  director: "gpt-5.4",
  copywriter: "gpt-5.4",
  "social-manager": "gpt-5.4",
  "paid-specialist": "gpt-5.4",
  "email-marketer": "gpt-5.4",
  "seo-specialist": "gpt-5.4",
  "brand-voice-guardian": "gpt-5.4",
};

function getActiveProvider(): "openai-codex" | "opencode-go" {
  return process.env.OPENCODE_API_KEY ? "opencode-go" : "openai-codex";
}

function getModelIdForProvider(role: string, provider: "openai-codex" | "opencode-go"): string {
  if (provider === "opencode-go") {
    return "deepseek-v4-flash";
  }
  return ROLE_MODEL[role] ?? "gpt-5.4";
}

export function modelForRole(role: string) {
  const provider = getActiveProvider();
  const id = getModelIdForProvider(role, provider);
  return getModel(provider, id as never)!;
}

export function modelForRoleWithOverride(role: string, override?: string) {
  const provider = getActiveProvider();
  const id = override ?? getModelIdForProvider(role, provider);
  return getModel(provider, id as never)!;
}

export { getEnvApiKey } from "@mariozechner/pi-ai";
