import type { WorkflowDef } from "./types.js";

export const linkedinPostWorkflow: WorkflowDef = {
  id: "linkedin_post",
  deliverableTypes: ["linkedin_post"],
  steps: [
    {
      id: "write",
      agent: "distribution-lead",
      taskFn: (ctx) =>
        `Készíts 1 db linkedin_post deliverable-t.\nBrief: ${ctx.brief.contentMd}`,
      requiresApproval: true,
    },
  ],
};
