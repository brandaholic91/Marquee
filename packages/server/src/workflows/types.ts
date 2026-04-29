export interface WorkflowState {
  keywords?: string;
  deliverableId?: string;
  [key: string]: unknown;
}

export interface WorkflowContext {
  brief: { id: string; contentMd: string; campaignId: string | null };
  state: WorkflowState;
  retryCount: number;
}

export interface WorkflowStep {
  id: string;
  agent: string;
  taskFn: (ctx: WorkflowContext) => string;
  condition?: (ctx: WorkflowContext) => boolean;
  requiresApproval?: boolean;
  extractOutput?: (artifactContent: string) => Partial<WorkflowState>;
}

export interface WorkflowDef {
  id: string;
  deliverableTypes: string[];
  steps: WorkflowStep[];
}
