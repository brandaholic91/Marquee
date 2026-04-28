import { useEffect } from "react";
import { useAgencyStore } from "./store/useAgencyStore";
import { HomeView } from "./views/home";
import { OnboardingView } from "./views/onboarding";
import { DeliverableView } from "./views/deliverable";
import { MemoryView } from "./views/memory";
import { ChatFullView } from "./views/chat-full";
import { PipelineView } from "./views/pipeline";
import { TasksView } from "./views/tasks";
import { AgentsView } from "./views/agents";

export function App() {
  const currentView = useAgencyStore((s) => s.currentView);
  const setView = useAgencyStore((s) => s.setView);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/memory/files")
      .then((r) => r.json())
      .then((files: Array<{ name: string }>) => {
        if (cancelled) return;
        const hasProfile = files.some((f) => f.name === "client_profile.md");
        if (!hasProfile) setView("onboarding");
      })
      .catch(() => {}); // fail silently — show home on error
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount; setView is a stable Zustand setter

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {currentView === "home" && <HomeView />}
      {currentView === "onboarding" && <OnboardingView />}
      {currentView === "deliverable" && <DeliverableView />}
      {currentView === "memory" && <MemoryView />}
      {currentView === "chat" && <ChatFullView />}
      {currentView === "pipeline" && <PipelineView />}
      {currentView === "tasks" && <TasksView />}
      {currentView === "agents" && <AgentsView />}
    </div>
  );
}
