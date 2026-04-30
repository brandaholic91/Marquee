import { useState } from 'react';
import { useMarqueeStore } from '../store/useMarqueeStore.js';
import { SidebarPanel, SidebarPanelHeader, SidebarPanelBody, SidebarPanelItem } from './SidebarPanel.js';

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

  const action = (
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
  );

  return (
    <SidebarPanel fullWidth={fullWidth}>
      <SidebarPanelHeader title="Beszélgetések" action={action} />
      <SidebarPanelBody>
        {active.map((t) => {
          const isActive = t.id === threadId;
          return (
            <SidebarPanelItem
              key={t.id}
              isActive={isActive}
              onClick={() => { if (renamingId !== t.id) void selectThread(t.id); }}
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
                  className="w-full text-sm bg-white border border-rule rounded px-1 py-0.5 outline-none"
                />
              ) : (
                <div className="flex items-center gap-1">
                  <span className="flex-1 text-sm truncate">
                    {t.title ?? 'Új beszélgetés'}
                  </span>
                  {isActive && (
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
              )}
            </SidebarPanelItem>
          );
        })}

        {archived.length > 0 && (
          <details className="mt-2">
            <summary className="px-4 py-1 text-xs text-ink-2 cursor-pointer select-none hover:text-ink-1">
              Archivált ({archived.length})
            </summary>
            {archived.map((t) => (
              <SidebarPanelItem
                key={t.id}
                onClick={() => void selectThread(t.id)}
                dim
              >
                <span className="text-sm truncate block">{t.title ?? 'Archivált'}</span>
              </SidebarPanelItem>
            ))}
          </details>
        )}
      </SidebarPanelBody>
    </SidebarPanel>
  );
}
