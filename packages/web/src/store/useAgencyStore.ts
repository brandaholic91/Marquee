import { create } from "zustand";

export interface Task {
  id: string;
  delegationId: string;
  title: string;
  descriptionMd: string;
  status: "open" | "in_progress" | "done" | "blocked" | "archived";
  assignedTo: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  campaignId?: string | null;
}

export interface Campaign {
  id: string;
  title: string;
  description: string | null;
  status: "active" | "completed" | "archived";
  createdAt: string;
  briefCount?: number;
  deliverableCount?: number;
  taskCount?: number;
  pendingApprovals?: number;
}

export interface CampaignDetail extends Campaign {
  briefs: { id: string; status: string; contentMd: string; createdAt: string }[];
  deliverables: { id: string; title: string; type: string; status: string }[];
  tasks: { id: string; title: string; status: string; assignedTo: string }[];
}

interface AgencyState {
  activeThreadId: string | null;
  drawerOpen: boolean;
  currentView: "home" | "chat" | "deliverable" | "memory" | "onboarding" | "pipeline" | "tasks" | "agents" | "skills" | "calendar" | "campaigns";
  selectedDeliverableId: string | null;
  selectedMemoryFile: string | null;
  tasks: Task[];
  campaigns: Campaign[];
  sidebarCollapsed: boolean;
  activeAgents: string[];
  setActiveThread: (id: string | null) => void;
  setDrawerOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveAgents: (slugs: string[]) => void;
  setView: (view: AgencyState["currentView"]) => void;
  setSelectedDeliverable: (id: string | null) => void;
  setSelectedMemoryFile: (file: string | null) => void;
  setTasks: (tasks: Task[]) => void;
  upsertTask: (task: Task) => void;
  setCampaigns: (campaigns: Campaign[]) => void;
}

export const useAgencyStore = create<AgencyState>((set) => ({
  activeThreadId: null,
  drawerOpen: false,
  currentView: "home",
  selectedDeliverableId: null,
  selectedMemoryFile: null,
  tasks: [],
  campaigns: [],
  sidebarCollapsed: false,
  activeAgents: [],
  setActiveThread: (id) => set({ activeThreadId: id }),
  setDrawerOpen: (open) => set({ drawerOpen: open }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setActiveAgents: (slugs) => set({ activeAgents: slugs }),
  setView: (view) => set({ currentView: view }),
  setSelectedDeliverable: (id) => set({ selectedDeliverableId: id, currentView: "deliverable" }),
  setSelectedMemoryFile: (file) => set({ selectedMemoryFile: file }),
  setTasks: (tasks) => set({ tasks }),
  upsertTask: (task) =>
    set((state) => {
      const idx = state.tasks.findIndex((t) => t.id === task.id);
      if (idx === -1) return { tasks: [...state.tasks, task] };
      const next = [...state.tasks];
      next[idx] = task;
      return { tasks: next };
    }),
  setCampaigns: (campaigns) => set({ campaigns }),
}));
