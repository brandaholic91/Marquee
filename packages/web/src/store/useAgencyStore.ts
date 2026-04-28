import { create } from "zustand";

export interface Task {
  id: string;
  delegationId: string;
  title: string;
  descriptionMd: string;
  status: "open" | "in_progress" | "done" | "blocked";
  assignedTo: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface AgencyState {
  activeThreadId: string | null;
  drawerOpen: boolean;
  currentView: "home" | "chat" | "deliverable" | "memory" | "onboarding" | "pipeline" | "tasks" | "agents";
  selectedDeliverableId: string | null;
  selectedMemoryFile: string | null;
  tasks: Task[];
  sidebarCollapsed: boolean;
  setActiveThread: (id: string | null) => void;
  setDrawerOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setView: (view: AgencyState["currentView"]) => void;
  setSelectedDeliverable: (id: string | null) => void;
  setSelectedMemoryFile: (file: string | null) => void;
  setTasks: (tasks: Task[]) => void;
  upsertTask: (task: Task) => void;
}

export const useAgencyStore = create<AgencyState>((set) => ({
  activeThreadId: null,
  drawerOpen: false,
  currentView: "home",
  selectedDeliverableId: null,
  selectedMemoryFile: null,
  tasks: [],
  sidebarCollapsed: false,
  setActiveThread: (id) => set({ activeThreadId: id }),
  setDrawerOpen: (open) => set({ drawerOpen: open }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
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
}));
