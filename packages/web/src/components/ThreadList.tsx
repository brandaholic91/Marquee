import { useState } from 'react';
import { useMarqueeStore } from '../store/useMarqueeStore.js';

export function ThreadList({ fullWidth, onClose }: { fullWidth?: boolean; onClose?: () => void }) {
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
    <aside className={`flex shrink-0 border-r border-rule flex-col bg-parchment overflow-hidden ${fullWidth ? 'w-full' : 'w-56'}`}>
      <div className="pl-14 md:pl-4 pr-4 pt-4 pb-3 border-b border-rule flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-ink-1 tracking-tight">Beszélgetések</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => void createThread()}
            className="text-xs text-primary hover:text-primary-hover font-medium px-2 py-1 rounded hover:bg-cream"
            title="Új beszélgetés"
          >
            + Új
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-ink-2 hover:text-ink-1 text-xl leading-none px-1"
              aria-label="Bezárás"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {active.map((t) => {
          const isActive = t.id === threadId;
          return (
            <div
              key={t.id}
              className={`group flex items-center gap-1 px-4 py-2.5 cursor-pointer border-l-2 transition-colors ${
                isActive ? 'border-primary bg-cream' : 'border-transparent hover:bg-cream'
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
                <span className={`flex-1 text-sm truncate ${isActive ? 'text-ink-1 font-medium' : 'text-ink-2'}`}>
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
                className="px-4 py-2 cursor-pointer hover:bg-cream border-l-2 border-transparent transition-colors"
                onClick={() => void selectThread(t.id)}
              >
                <span className="text-sm text-ink-3 truncate block">{t.title ?? 'Archivált'}</span>
              </div>
            ))}
          </details>
        )}
      </div>
    </aside>
  );
}
