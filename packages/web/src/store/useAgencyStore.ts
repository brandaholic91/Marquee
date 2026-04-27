import { create } from "zustand";

interface AgencyState {
  activeThreadId: string | null;
  drawerOpen: boolean;
  currentView: "home" | "chat" | "deliverable" | "memory" | "onboarding" | "pipeline";
  selectedDeliverableId: string | null;
  selectedMemoryFile: string | null;
  setActiveThread: (id: string | null) => void;
  setDrawerOpen: (open: boolean) => void;
  setView: (view: AgencyState["currentView"]) => void;
  setSelectedDeliverable: (id: string | null) => void;
  setSelectedMemoryFile: (file: string | null) => void;
}

export const useAgencyStore = create<AgencyState>((set) => ({
  activeThreadId: null,
  drawerOpen: false,
  currentView: "home",
  selectedDeliverableId: null,
  selectedMemoryFile: null,
  setActiveThread: (id) => set({ activeThreadId: id }),
  setDrawerOpen: (open) => set({ drawerOpen: open }),
  setView: (view) => set({ currentView: view }),
  setSelectedDeliverable: (id) => set({ selectedDeliverableId: id, currentView: "deliverable" }),
  setSelectedMemoryFile: (file) => set({ selectedMemoryFile: file }),
}));
