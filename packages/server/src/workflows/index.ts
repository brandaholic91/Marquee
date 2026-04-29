import type { WorkflowDef } from "./types.js";
import { blogPostWorkflow } from "./blog_post.js";
import { linkedinPostWorkflow } from "./linkedin_post.js";
import { landingPageWorkflow } from "./landing_page.js";

export type { WorkflowDef, WorkflowStep, WorkflowContext, WorkflowState } from "./types.js";

const ALL_WORKFLOWS: WorkflowDef[] = [
  blogPostWorkflow,
  linkedinPostWorkflow,
  landingPageWorkflow,
];

const REGISTRY = new Map<string, WorkflowDef>();
for (const wf of ALL_WORKFLOWS) {
  for (const type of wf.deliverableTypes) {
    REGISTRY.set(type.toLowerCase(), wf);
  }
}

export function getWorkflow(deliverableType: string): WorkflowDef | undefined {
  return REGISTRY.get(deliverableType.toLowerCase());
}

export const KNOWN_DELIVERABLE_TYPES = [
  "blog_post",
  "linkedin_post",
  "landing_page",
  "twitter_thread",
  "seo_report",
  "case_study",
  "ad_copy",
  "email",
  "video_script",
  "white_paper",
] as const;

export function parseDeliverableType(contentMd: string): string | null {
  const match = contentMd.match(
    /\b(blog_post|linkedin_post|landing_page|twitter_thread|seo_report|case_study|ad_copy|email|video_script|white_paper)\b/i
  );
  return match?.[1]?.toLowerCase() ?? null;
}
