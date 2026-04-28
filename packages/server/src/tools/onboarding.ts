import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { AgentToolDef } from "./types.js";

const completeOnboardingInput = z.object({
	client_name: z.string().min(1),
	icp: z.string().min(1),
	usp: z.string().min(1),
	brand_voice: z.string().min(1),
	competitors: z.string().optional(),
	tone_of_voice: z.string().optional(),
	reference_posts: z.string().optional(),
});

export function makeCompleteOnboarding(dataDir: string): AgentToolDef<z.infer<typeof completeOnboardingInput>, { ok: boolean }> {
	return {
		name: "complete_onboarding",
		description: "Save the collected client information to memory files and complete the onboarding. Call this when you have gathered all required information from the client.",
		schema: {
			type: "object",
			properties: {
				client_name: { type: "string" },
				icp: { type: "string" },
				usp: { type: "string" },
				brand_voice: { type: "string" },
				competitors: { type: "string" },
				tone_of_voice: { type: "string" },
				reference_posts: { type: "string" },
			},
			required: ["client_name", "icp", "usp", "brand_voice"],
		},
		input: completeOnboardingInput,
		async execute(input, ctx) {
			const memDir = join(dataDir, "memory");
			mkdirSync(memDir, { recursive: true });

			const clientProfile = [
				"---",
				`title: Client Profile`,
				`client_name: "${input.client_name}"`,
				`icp: "${input.icp}"`,
				`usp: "${input.usp}"`,
				`competitors: "${input.competitors ?? ""}"`,
				`brand_voice: "${input.brand_voice}"`,
				"---",
				"",
			].join("\n");

			const brandGuidelines = [
				"---",
				`title: Brand Guidelines`,
				`tone_of_voice: "${input.tone_of_voice ?? input.brand_voice}"`,
				`reference_posts: "${input.reference_posts ?? ""}"`,
				`formatting_rules: "Rövid mondatok. Nincs felesleges szöveg. Adatalapú, ahol lehet."`,
				"---",
				"",
			].join("\n");

			writeFileSync(join(memDir, "client_profile.md"), clientProfile, "utf8");
			writeFileSync(join(memDir, "brand_guidelines.md"), brandGuidelines, "utf8");

			ctx.emit("onboarding_complete", { client_name: input.client_name });
			return { ok: true };
		},
	};
}
