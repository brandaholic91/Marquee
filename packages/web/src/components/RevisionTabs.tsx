interface Revision {
  id: string;
  revisionNo: number;
}

interface RevisionTabsProps {
  revisions: Revision[];
  currentId: string | undefined;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function RevisionTabs({ revisions, currentId, selectedId, onSelect }: RevisionTabsProps) {
  if (revisions.length === 0) return null;
  return (
    <div className="flex gap-1 border-b border-rule">
      {revisions.map((r) => (
        <button
          key={r.id}
          onClick={() => onSelect(r.id)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            r.id === selectedId
              ? 'border-primary text-primary-hover'
              : 'border-transparent text-ink-2 hover:text-ink-1'
          }`}
        >
          Verzió {r.revisionNo}{r.id === currentId ? ' (jelenlegi)' : ''}
        </button>
      ))}
    </div>
  );
}
