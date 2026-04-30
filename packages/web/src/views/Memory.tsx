import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { memoryApi } from '../lib/api.js';
import { MemoryFileList } from '../components/MemoryFileList.js';
import { MemoryProposalCard } from '../components/MemoryProposalCard.js';

const SLUG = 'default';

interface ProposalShape {
  id: string;
  file: string;
  newContent: string;
  reason: string | null;
  createdAt: number;
}

interface FileMeta {
  frontmatter: Record<string, string>;
  body: string;
  rawContent: string;
}

export function Memory() {
  const [fileFlags, setFileFlags] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState('profile.md');
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  const [fileMeta, setFileMeta] = useState<FileMeta | null>(null);
  const [proposals, setProposals] = useState<ProposalShape[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadAll = async () => {
    const [files, props] = await Promise.all([
      memoryApi.files(SLUG),
      memoryApi.proposals(SLUG),
    ]);
    const flags: Record<string, boolean> = {};
    for (const f of files) flags[f.file] = f.exists;
    setFileFlags(flags);
    setProposals(props as ProposalShape[]);
  };

  const loadFile = async (file: string) => {
    try {
      const r = await memoryApi.get(SLUG, file);
      setFileMeta({
        frontmatter: (r?.frontmatter as Record<string, string>) ?? {},
        body: r?.body ?? '',
        rawContent: r?.rawContent ?? '',
      });
    } catch {
      setFileMeta({ frontmatter: {}, body: '', rawContent: '' });
    }
    setEditMode(false);
    setSaveError(null);
  };

  useEffect(() => { void loadAll(); }, []);
  useEffect(() => { void loadFile(selected); }, [selected]);

  const handleEdit = () => {
    setEditValue(fileMeta?.rawContent ?? '');
    setEditMode(true);
    setSaveError(null);
  };

  const handleCancel = () => {
    setEditMode(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const r = await memoryApi.put(SLUG, selected, editValue) as { ok?: true; error?: string };
      if (r?.ok) {
        await loadFile(selected);
        await loadAll();
      } else {
        setSaveError(r?.error ?? 'Mentés sikertelen.');
      }
    } catch {
      setSaveError('Hálózati hiba.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await memoryApi.approveProposal(id);
      await loadAll();
      await loadFile(selected);
    } catch { /* silent */ }
  };

  const handleReject = async (id: string) => {
    try {
      await memoryApi.rejectProposal(id);
      await loadAll();
      await loadFile(selected);
    } catch { /* silent */ }
  };

  const fm = fileMeta?.frontmatter ?? {};

  return (
    <div className="flex flex-1 h-screen overflow-hidden">

      {/* Fájllista */}
      <div className={`${mobileView === 'detail' ? 'hidden md:flex' : 'flex'} w-full md:w-56 md:shrink-0 bg-parchment border-r border-rule flex-col`}>
        <div className="pl-14 md:pl-4 pr-4 pt-4 pb-3 border-b border-rule">
          <h1 className="text-[15px] font-bold text-ink-1 tracking-tight">Memória</h1>
          <p className="text-[12px] text-ink-3 mt-0.5">
            {Object.keys(fileFlags).length} fájl
            {proposals.length > 0 ? ` · ${proposals.length} javaslat` : ''}
          </p>
        </div>

        {proposals.length > 0 && (
          <div className="mx-2 mt-2">
            <button className="w-full flex items-center gap-2 bg-primary-soft border border-primary rounded-[6px] px-2.5 py-1.5 text-[11px] font-semibold text-primary-deep">
              <span className="bulb" />
              {proposals.length} függő javaslat
            </button>
          </div>
        )}

        <div className="flex-1 overflow-auto p-2">
          <MemoryFileList fileFlags={fileFlags} selected={selected} onSelect={(f) => { setSelected(f); setMobileView('detail'); }} />
        </div>
      </div>

      {/* Editor panel */}
      <div className={`${mobileView === 'detail' ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0 overflow-hidden`}>

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-rule bg-cream flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileView('list')}
              className="md:hidden text-ink-2 text-[13px] font-medium shrink-0"
            >
              ← Vissza
            </button>
            <span className="font-mono text-[14px] font-bold text-ink-1">{selected}</span>
            {fm.description && (
              <span className="text-[11px] text-ink-3">{fm.description}</span>
            )}
          </div>
          {!editMode ? (
            <button onClick={handleEdit} className="bg-off-white border border-rule text-ink-2 font-medium text-[12px] px-3 py-1.5 rounded-btn">Szerkesztés</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleCancel} className="text-ink-3 text-[12px] font-medium px-3 py-1.5">Mégse</button>
              <button onClick={() => void handleSave()} disabled={isSaving} className="bg-primary text-sidebar-bg font-bold text-[12px] px-3 py-1.5 rounded-btn disabled:opacity-50">{isSaving ? 'Mentés…' : 'Mentés'}</button>
            </div>
          )}
        </div>

        {/* Proposals */}
        {proposals.length > 0 && (
          <div className="px-5 py-4 border-b border-rule">
            <p className="text-[11px] font-semibold text-ink-2 mb-2">Függő javaslatok ({proposals.length})</p>
            {proposals.map((p) => (
              <MemoryProposalCard
                key={p.id}
                proposal={p}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        )}

        {/* Tartalom */}
        <div className="flex-1 overflow-auto p-5 pb-14 md:pb-5">
          {!editMode ? (
            <div className="bg-off-white border border-rule rounded-card p-5 max-w-2xl">
              {/* Frontmatter metaadat-sáv */}
              {(fm.name || fm.type) && (
                <div className="bg-parchment rounded-[6px] px-3 py-2 mb-4 flex gap-4">
                  {fm.name && (
                    <span className="text-[10px] text-ink-3">
                      <strong className="text-ink-2 font-semibold">Fájl:</strong> {fm.name}
                    </span>
                  )}
                  {fm.type && (
                    <span className="text-[10px] text-ink-3">
                      <strong className="text-ink-2 font-semibold">Típus:</strong> {fm.type}
                    </span>
                  )}
                </div>
              )}
              {/* Renderelt markdown */}
              <div className="prose prose-sm max-w-none text-ink-1">
                <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                  {fileMeta?.body ?? ''}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-w-2xl">
              {saveError && <p className="text-[12px] text-danger-deep">{saveError}</p>}
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full bg-off-white border border-rule-strong rounded-card p-4 font-mono text-[13px] text-ink-1 outline-none resize-none min-h-[400px]"
                spellCheck={false}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
