import { z } from "zod";
import { loadSkillBody, listSkillsForRole } from "../skills/loader.js";
import type { AgentToolDef } from "./types.js";

const useSkillInput = z.object({
	name: z.string(),
});

export function makeUseSkill(dataDir: string): AgentToolDef<z.infer<typeof useSkillInput>, string> {
	return {
		name: "use_skill",
		description: "Load the full instructions for a skill. Call this before starting work on a task that matches a skill's description.",
		schema: {
			type: "object",
			properties: {
				name: { type: "string", description: "The skill name to load" },
			},
			required: ["name"],
		},
		input: useSkillInput,
		async execute(input, ctx) {
			const body = loadSkillBody(dataDir, ctx.agentSlug, input.name);
			if (!body) {
				const available = listSkillsForRole(dataDir, ctx.agentSlug).map((s) => s.name);
				if (available.length === 0) return `Skill "${input.name}" not found. No skills available for this role.`;
				return `Skill "${input.name}" not found. Available: ${available.join(", ")}`;
			}
			return body;
		},
	};
}
