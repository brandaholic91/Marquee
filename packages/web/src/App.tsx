import { useAgencyStore } from "./store/useAgencyStore";
import { HomeView } from "./views/home";
import { OnboardingView } from "./views/onboarding";
import { DeliverableView } from "./views/deliverable";
import { MemoryView } from "./views/memory";
import { ChatDrawer } from "./components/chat/ChatDrawer";

export function App() {
  const { currentView, setView } = useAgencyStore();

  return (
    <div className="h-screen flex flex-col bg-[hsl(var(--background))] overflow-hidden">
      {/* Nav */}
      <nav className="flex items-center gap-4 px-6 py-3 border-b border-[hsl(var(--border))]">
        <span
          className="font-serif font-semibold text-[hsl(var(--primary))] cursor-pointer"
          onClick={() => setView("home")}
        >
          marquee
        </span>
        <button className="text-sm hover:text-[hsl(var(--primary))]" onClick={() => setView("home")}>Dashboard</button>
        <button className="text-sm hover:text-[hsl(var(--primary))]" onClick={() => setView("memory")}>Memory</button>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {currentView === "home" && <HomeView />}
        {currentView === "deliverable" && <DeliverableView />}
        {currentView === "memory" && <MemoryView />}
        {currentView === "chat" && (
          <div className="flex items-center justify-center h-full text-[hsl(var(--muted-foreground))]">
            Select a conversation
          </div>
        )}
      </main>

      {/* Always-mounted chat drawer */}
      <ChatDrawer />
    </div>
  );
}
