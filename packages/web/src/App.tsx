import { Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar.js';
import { BottomNav } from './components/BottomNav.js';
import { HQ } from './views/HQ.js';
import { Workshop } from './views/Workshop.js';
import { Approvals } from './views/Approvals.js';
import { Memory } from './views/Memory.js';
import { Campaigns } from './views/Campaigns.js';
import { Agency } from './views/Agency.js';
import { AgentConfig } from './views/AgentConfig.js';

export function App() {
  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Routes>
          <Route path="/hq" element={<HQ />} />
          <Route path="/" element={<Workshop />} />
          <Route path="/jovahagyas" element={<Approvals />} />
          <Route path="/jovahagyas/:id" element={<Approvals />} />
          <Route path="/kampanyok" element={<Campaigns />} />
          <Route path="/memoria" element={<Memory />} />
          <Route path="/ugynokseg" element={<Agency />} />
          <Route path="/ugynokseg/:role" element={<AgentConfig />} />
          <Route path="*" element={<Navigate to="/hq" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
