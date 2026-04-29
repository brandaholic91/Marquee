import { Routes, Route, Navigate } from 'react-router-dom';
import { TopNav } from './components/TopNav.js';
import { Workshop } from './views/Workshop.js';
import { Approvals } from './views/Approvals.js';
import { DeliverableDetail } from './views/DeliverableDetail.js';
import { Memory } from './views/Memory.js';

export function App() {
  return (
    <div className="min-h-screen bg-cream text-ink-1">
      <TopNav />
      <main className="max-w-screen-xl mx-auto px-8 py-6">
        <Routes>
          <Route path="/" element={<Workshop />} />
          <Route path="/jovahagyas" element={<Approvals />} />
          <Route path="/jovahagyas/:id" element={<DeliverableDetail />} />
          <Route path="/memoria" element={<Memory />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
