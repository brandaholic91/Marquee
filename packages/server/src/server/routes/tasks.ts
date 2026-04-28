import type { FastifyInstance } from "fastify";
import type { ServerOpts } from "../index.js";
import { tasks } from "../../db/schema.js";
import { updateTaskInDb, ConflictError } from "../../tasks/manager.js";

export function registerTaskRoutes(app: FastifyInstance, opts: ServerOpts) {
  app.get<{ Querystring: { assigned_to?: string; status?: string } }>("/api/tasks", async (req) => {
    let result = opts.db.select().from(tasks).all();
    if (req.query.assigned_to) result = result.filter((t) => t.assignedTo === req.query.assigned_to);
    if (req.query.status) result = result.filter((t) => t.status === req.query.status);
    return result;
  });

  app.patch<{
    Params: { id: string };
    Body: { title?: string; description_md?: string; status?: string; current_version: number };
  }>("/api/tasks/:id", async (req, reply) => {
    const { current_version, title, description_md, status } = req.body;
    const patch: { title?: string; descriptionMd?: string; status?: "open" | "in_progress" | "done" | "blocked" } = {};
    if (title !== undefined) patch.title = title;
    if (description_md !== undefined) patch.descriptionMd = description_md;
    if (status !== undefined) patch.status = status as never;
    try {
      const updated = updateTaskInDb(opts.db, req.params.id, patch, current_version);
      opts.broker.emit("task_updated", { taskId: updated.id, patch, updatedBy: "human" });
      return { ok: true, taskId: updated.id, newVersion: updated.version };
    } catch (e) {
      if (e instanceof ConflictError) return reply.code(409).send({ error: e.message });
      throw e;
    }
  });
}
