import { useState } from 'react';
import { useMarqueeStore } from '../store/useMarqueeStore.js';

export function ThreadList() {
  const threads = useMarqueeStore((s) => s.threads);
  const threadId = useMarqueeStore((s) => s.threadId);
  const createThread = useMarqueeStore((s) => s.createThread);
  const selectThread = useMarqueeStore((s) => s.selectThread);
  const archiveThread = useMarqueeStore((s) => s.archiveThread);
  const renameThread = useMarqueeStore((s) => s.renameThread);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const active = threads.filter((t) => !t.archivedAt);
  const archived = threads.filter((t) => t.archivedAt);

  function startRename(id: string, currentTitle: string | null) {
    setRenamingId(id);
    setRenameValue(currentTitle ?? '');
  }

  async function commitRename(id: string) {
    if (renameValue.trim()) await renameThread(id, renameValue.trim());
    setRenamingId(null);
  }

  return (
    <aside className="w-[200px] shrink-0 border-r border-rule flex flex-col bg-parchment overflow-hidden">
      <div className="px-3 pt-4 pb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-2">Beszélgetések</span>
        <button
          onClick={() => void createThread()}
          className="text-xs text-primary-hover hover:text-primary px-2 py-1 rounded hover:bg-cream"
          title="Új beszélgetés"
        >
          + Új
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {active.map((t) => {
          const isActive = t.id === threadId;
          return (
            <div
              key={t.id}
              className={`group flex items-center gap-1 px-3 py-2 cursor-pointer ${
                isActive ? 'bg-primary-soft' : 'hover:bg-cream'
              }`}
              onClick={() => void selectThread(t.id)}
            >
              {renamingId === t.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => void commitRename(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void commitRename(t.id);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 text-sm bg-white border border-rule rounded px-1 py-0.5 outline-none"
                />
              ) : (
                <span className={`flex-1 text-sm truncate ${isActive ? 'text-primary-hover font-medium' : 'text-ink-1'}`}>
                  {t.title ?? 'Új beszélgetés'}
                </span>
              )}
              {isActive && renamingId !== t.id && (
                <div className="hidden group-hover:flex gap-0.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); startRename(t.id, t.title); }}
                    className="p-0.5 text-ink-2 hover:text-ink-1 rounded"
                    title="Átnevezés"
                  >
                    ✎
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); void archiveThread(t.id); }}
                    className="p-0.5 text-ink-2 hover:text-ink-1 rounded"
                    title="Archiválás"
                  >
                    ↓
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {archived.length > 0 && (
          <details className="mt-2">
            <summary className="px-3 py-1 text-xs text-ink-2 cursor-pointer select-none hover:text-ink-1">
              Archivált ({archived.length})
            </summary>
            {archived.map((t) => (
              <div
                key={t.id}
                className="px-3 py-1.5 cursor-pointer hover:bg-cream"
                onClick={() => void selectThread(t.id)}
              >
                <span className="text-sm text-ink-2 truncate block">{t.title ?? 'Archivált'}</span>
              </div>
            ))}
          </details>
        )}
      </div>
    </aside>
  );
}
