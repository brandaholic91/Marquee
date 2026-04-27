import { useEffect } from "react";
import { useAgencyStore } from "./store/useAgencyStore";
import { HomeView } from "./views/home";
import { OnboardingView } from "./views/onboarding";
import { DeliverableView } from "./views/deliverable";
import { MemoryView } from "./views/memory";
import { ChatFullView } from "./views/chat-full";

export function App() {
  const currentView = useAgencyStore((s) => s.currentView);
  const setView = useAgencyStore((s) => s.setView);

  useEffect(() => {
    if (currentView !== "home") return;
    fetch("/api/memory/files")
      .then((r) => r.json())
      .then((files: Array<{ name: string }>) => {
        const hasProfile = files.some((f) => f.name === "client_profile.md");
        if (!hasProfile) setView("onboarding");
      })
      .catch(() => {}); // fail silently — show home on error
  }, []); // run once on mount

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {currentView === "home" && <HomeView />}
      {currentView === "onboarding" && <OnboardingView />}
      {currentView === "deliverable" && <DeliverableView />}
      {currentView === "memory" && <MemoryView />}
      {currentView === "chat" && <ChatFullView />}
    </div>
  );
}
