import { getModel } from "@mariozechner/pi-ai";

const ROLE_MODEL: Record<string, string> = {
  director: "gpt-5.4",
  copywriter: "gpt-5.4",
  "social-manager": "gpt-5.4-mini",
  "paid-specialist": "gpt-5.4-mini",
};

export function modelForRole(role: string) {
  const id = ROLE_MODEL[role] ?? "gpt-5.4-mini";
  return getModel("openai-codex", id as never)!;
}

export { getEnvApiKey } from "@mariozechner/pi-ai";
