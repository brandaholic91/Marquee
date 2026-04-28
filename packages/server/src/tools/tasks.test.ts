import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDb, type AgencyDb } from "../db/index.js";
import { delegations, tasks } from "../db/schema.js";
import { updateTask } from "./tasks.js";
import { ConflictError } from "../tasks/manager.js";
import type { ToolContext } from "./types.js";

function makeCtx(db: AgencyDb): ToolContext {
	return {
		db,
		agentSlug: "director",
		agentSessionId: randomUUID(),
		emit: vi.fn(),
	};
}

describe("update_task tool", () => {
	let dir: string;
	let db: AgencyDb;
	let close: () => void;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "tools-tasks-test-"));
		const handle = openDb(join(dir, "test.db"));
		db = handle.db;
		close = handle.close;
	});

	afterEach(() => {
		close();
		rmSync(dir, { recursive: true, force: true });
	});

	function insertTask(status = "open" as const) {
		const delegationId = randomUUID();
		db.insert(delegations)
			.values({
				id: delegationId,
				fromAgent: "director",
				toAgent: "copywriter",
				status: "requested",
				payloadJson: { task: "x" } as never,
			})
			.run();
		const taskId = randomUUID();
		db.insert(tasks)
			.values({
				id: taskId,
				delegationId,
				title: "My task",
				status,
				assignedTo: "copywriter",
			})
			.run();
		return taskId;
	}

	it("returns ok with new version on success", async () => {
		const taskId = insertTask();
		const result = await updateTask.execute(
			{ task_id: taskId, current_version: 1, status: "in_progress" },
			makeCtx(db),
		);
		expect(result.ok).toBe(true);
		expect(result.newVersion).toBe(2);
	});

	it("emits task_updated event", async () => {
		const taskId = insertTask();
		const emit = vi.fn();
		await updateTask.execute(
			{ task_id: taskId, current_version: 1, title: "New title" },
			{ ...makeCtx(db), emit },
		);
		expect(emit).toHaveBeenCalledWith(
			"task_updated",
			expect.objectContaining({ taskId, updatedBy: "director" }),
		);
	});

	it("throws ConflictError on stale version", async () => {
		const taskId = insertTask();
		await expect(
			updateTask.execute(
				{ task_id: taskId, current_version: 99 },
				makeCtx(db),
			),
		).rejects.toThrow(ConflictError);
	});
});
