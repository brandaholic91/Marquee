// Note: @mariozechner/pi-ai v0.70.2 cannot be imported at runtime due to a broken
// typebox peer dependency (requires typebox/build/index.mjs which does not exist in
// typebox v1.x). We return plain typed objects matching the pi-ai Model shape so that
// the rest of the codebase can switch to getModel() once the dependency is resolved.

export type ProviderMode = "flat" | "api";

export interface ModelDescriptor {
	provider: string;
	id: string;
}

export const providerMode = (): ProviderMode =>
	(process.env.HERMES_PROVIDER_MODE as ProviderMode) ?? "flat";

// opencode-go local models (OpenCode Go runner)
const FLAT_MAP: Record<string, string> = {
	director: "kimi-k2.6",
	"content-lead": "kimi-k2.6",
	copywriter: "kimi-k2.6",
	"eval-judge": "minimax-m2.7",
};

// OpenRouter cloud model IDs (verified against pi-ai models.generated registry)
const API_MAP: Record<string, string> = {
	director: "anthropic/claude-sonnet-4.6",
	"content-lead": "anthropic/claude-haiku-4.5",
	copywriter: "anthropic/claude-sonnet-4.6",
	"eval-judge": "anthropic/claude-haiku-4.5",
};

export function modelForRole(role: string): ModelDescriptor {
	const mode = providerMode();
	if (mode === "flat") {
		return {
			provider: "opencode-go",
			id: FLAT_MAP[role] ?? "kimi-k2.6",
		};
	}
	return {
		provider: "openrouter",
		id: API_MAP[role] ?? "anthropic/claude-haiku-4.5",
	};
}
