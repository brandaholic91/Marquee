import { getModel, getEnvApiKey } from "@mariozechner/pi-ai";

export type ProviderMode = "flat" | "api" | "openai-subscription";
export const providerMode = (): ProviderMode =>
	(process.env.MARQUEE_PROVIDER_MODE as ProviderMode) ?? "flat";

const FLAT_MAP: Record<string, string> = {
	director: "kimi-k2.6",
	"content-lead": "kimi-k2.6",
	copywriter: "kimi-k2.6",
	"eval-judge": "minimax-m2.7",
};

const API_MAP: Record<string, string> = {
	director: "anthropic/claude-sonnet-4.6",
	"content-lead": "anthropic/claude-haiku-4.5",
	copywriter: "anthropic/claude-sonnet-4.6",
	"eval-judge": "anthropic/claude-haiku-4.5",
};

const SUBSCRIPTION_FALLBACK_MAP: Record<string, string> = {
	director:            "gpt-5.4",
	copywriter:          "gpt-5.4",
	"content-lead":      "gpt-5.4-mini",
	"distribution-lead": "gpt-5.4-mini",
	"insights-lead":     "gpt-5.4-mini",
	"social-manager":    "gpt-5.4-mini",
	"seo-analyst":       "gpt-5.4-mini",
	"eval-judge":        "gpt-5.4-mini",
};

export function modelForRole(role: string, configModel?: string) {
	const mode = providerMode();
	if (mode === "flat") {
		const id = FLAT_MAP[role] ?? "kimi-k2.6";
		return getModel("opencode-go", id as never)!;
	}
	if (mode === "api") {
		const id = API_MAP[role] ?? "anthropic/claude-haiku-4.5";
		return getModel("openrouter", id as never)!;
	}
	// openai-subscription
	const id = configModel ?? SUBSCRIPTION_FALLBACK_MAP[role] ?? "gpt-5.1-codex-mini";
	return getModel("openai-codex", id as never)!;
}

export { getEnvApiKey };
