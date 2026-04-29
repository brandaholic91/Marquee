import { Link } from 'react-router-dom';
import { StatusBadge } from './StatusBadge.js';
import { TypeBadge } from './TypeBadge.js';

interface DeliverableRowProps {
  id: string;
  type: string;
  status: string;
  updatedAt: number;
}

export function DeliverableRow({ id, type, status, updatedAt }: DeliverableRowProps) {
  return (
    <Link
      to={`/jovahagyas/${id}`}
      className="block bg-off-white border border-rule rounded-lg px-4 py-3 hover:bg-parchment"
    >
      <div className="flex items-center gap-3">
        <TypeBadge type={type} />
        <StatusBadge status={status} />
        <span className="ml-auto text-sm text-ink-2">
          {new Date(updatedAt).toLocaleString('hu-HU')}
        </span>
      </div>
    </Link>
  );
}
