import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { modelForRole, providerMode } from "./index.js";

describe("providers", () => {
	beforeEach(() => { delete process.env.MARQUEE_PROVIDER_MODE; });
	afterEach(() => { delete process.env.MARQUEE_PROVIDER_MODE; });

	it("returns Kimi K2.6 for director in flat mode", () => {
		process.env.MARQUEE_PROVIDER_MODE = "flat";
		const m = modelForRole("director");
		expect(m.provider).toBe("opencode-go");
		expect(m.id).toMatch(/kimi-k2\.6/i);
	});

	it("returns Haiku for content-lead in api mode", () => {
		process.env.MARQUEE_PROVIDER_MODE = "api";
		const m = modelForRole("content-lead");
		expect(m.provider).toBe("openrouter");
		expect(m.id).toContain("claude-haiku");
	});

	it("providerMode reads env var", () => {
		process.env.MARQUEE_PROVIDER_MODE = "flat";
		expect(providerMode()).toBe("flat");
	});

	it("returns openai-codex model for director in openai-subscription mode (no override)", () => {
		process.env.MARQUEE_PROVIDER_MODE = "openai-subscription";
		const m = modelForRole("director");
		expect(m.provider).toBe("openai-codex");
		expect(m.id).toBe("gpt-5.4");
	});

	it("returns openai-codex fallback for eval-judge in openai-subscription mode", () => {
		process.env.MARQUEE_PROVIDER_MODE = "openai-subscription";
		const m = modelForRole("eval-judge");
		expect(m.provider).toBe("openai-codex");
		expect(m.id).toBe("gpt-5.4-mini");
	});

	it("uses configModel override in openai-subscription mode", () => {
		process.env.MARQUEE_PROVIDER_MODE = "openai-subscription";
		const m = modelForRole("director", "gpt-5.5");
		expect(m.provider).toBe("openai-codex");
		expect(m.id).toBe("gpt-5.5");
	});
});
