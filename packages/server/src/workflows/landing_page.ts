import type { WorkflowDef } from "./types.js";

export const landingPageWorkflow: WorkflowDef = {
  id: "landing_page",
  deliverableTypes: ["landing_page"],
  steps: [
    {
      id: "seo",
      agent: "insights-lead",
      condition: (ctx) => !ctx.state.keywords,
      taskFn: (ctx) =>
        `Végezz kulcsszókutatást landing_page deliverable-hoz.\nTéma: ${ctx.brief.contentMd.slice(0, 200)}`,
      extractOutput: (artifactContent) => {
        const match = artifactContent.match(
          /\*\*Elsődleges kulcsszó[^:]*\*\*[:\s]+([^\n]+)/
        );
        return { keywords: match?.[1]?.trim() ?? undefined };
      },
    },
    {
      id: "write",
      agent: "content-lead",
      taskFn: (ctx) =>
        [
          `Írj 1 db landing_page deliverable-t.`,
          ctx.state.keywords ? `Elsődleges kulcsszó: ${ctx.state.keywords}` : "",
          `Brief: ${ctx.brief.contentMd}`,
        ]
          .filter(Boolean)
          .join("\n"),
      requiresApproval: true,
    },
  ],
};
