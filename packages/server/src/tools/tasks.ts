import { z } from "zod";
import { updateTaskInDb, ConflictError } from "../tasks/manager.js";
import type { AgentToolDef, ToolContext } from "./types.js";

export { ConflictError };

const updateTaskInput = z.object({
	task_id: z.string(),
	current_version: z.number().int(),
	title: z.string().optional(),
	description_md: z.string().optional(),
	status: z.enum(["open", "in_progress", "done", "blocked"]).optional(),
});

export const updateTask: AgentToolDef<
	z.infer<typeof updateTaskInput>,
	{ ok: true; taskId: string; newVersion: number }
> = {
	name: "update_task",
	description:
		"Update a task's title, description, or status. Supply current_version to prevent conflicts.",
	schema: {
		type: "object",
		properties: {
			task_id: { type: "string" },
			current_version: { type: "integer" },
			title: { type: "string" },
			description_md: { type: "string" },
			status: {
				type: "string",
				enum: ["open", "in_progress", "done", "blocked"],
			},
		},
		required: ["task_id", "current_version"],
	},
	input: updateTaskInput,
	async execute(input, ctx: ToolContext) {
		const patch: {
			title?: string;
			descriptionMd?: string;
			status?: "open" | "in_progress" | "done" | "blocked";
		} = {};
		if (input.title !== undefined) patch.title = input.title;
		if (input.description_md !== undefined) patch.descriptionMd = input.description_md;
		if (input.status !== undefined) patch.status = input.status;

		const updated = updateTaskInDb(ctx.db, input.task_id, patch, input.current_version);
		ctx.emit("task_updated", { taskId: updated.id, patch, updatedBy: ctx.agentSlug });
		return { ok: true, taskId: updated.id, newVersion: updated.version };
	},
};
