import { useEffect, useState } from 'react';
import { useMarqueeStore } from '../store/useMarqueeStore.js';
import { DeliverableRow } from '../components/DeliverableRow.js';

const FILTERS = [
  { value: 'awaiting_approval', label: 'Jóváhagyásra vár' },
  { value: 'all',               label: 'Mind' },
  { value: 'drafting',          label: 'Vázlat' },
  { value: 'shipped',           label: 'Lezárva' },
  { value: 'archived',          label: 'Archív' },
];

export function Approvals() {
  const [filter, setFilter] = useState('awaiting_approval');
  const deliverables = useMarqueeStore((s) => s.deliverables);
  const fetchDeliverables = useMarqueeStore((s) => s.fetchDeliverables);

  useEffect(() => {
    fetchDeliverables(filter === 'all' ? undefined : filter);
  }, [filter, fetchDeliverables]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="font-serif text-2xl">Jóváhagyás</h1>
        <select
          className="ml-auto border border-rule-strong rounded-md px-3 py-1.5 bg-off-white"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <ul className="space-y-2">
        {deliverables.map((d) => (
          <li key={d.id}>
            <DeliverableRow
              id={d.id}
              type={d.type}
              status={d.status}
              updatedAt={d.updatedAt}
            />
          </li>
        ))}
        {deliverables.length === 0 && (
          <li className="text-ink-2 text-center py-12">
            Nincs deliverable ebben a szűrőben.
          </li>
        )}
      </ul>
    </div>
  );
}
