import { getModel, getEnvApiKey } from "@mariozechner/pi-ai";

export type ProviderMode = "flat" | "api";
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

export function modelForRole(role: string) {
	const mode = providerMode();
	if (mode === "flat") {
		const id = FLAT_MAP[role] ?? "kimi-k2.6";
		return getModel("opencode-go", id as never)!;
	}
	const id = API_MAP[role] ?? "anthropic/claude-haiku-4.5";
	return getModel("openrouter", id as never)!;
}

export { getEnvApiKey };
