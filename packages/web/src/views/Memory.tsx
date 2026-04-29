import { useEffect, useState } from 'react';
import { memoryApi } from '../lib/api.js';
import { MemoryFileList } from '../components/MemoryFileList.js';
import { MemoryEditor } from '../components/MemoryEditor.js';
import { MemoryProposalCard } from '../components/MemoryProposalCard.js';

const SLUG = 'default';

interface ProposalShape {
  id: string;
  file: string;
  newContent: string;
  reason: string | null;
  createdAt: number;
}

export function Memory() {
  const [fileFlags, setFileFlags] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState('profile.md');
  const [content, setContent] = useState<string | null>(null);
  const [proposals, setProposals] = useState<ProposalShape[]>([]);

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
      setContent(r?.rawContent ?? '');
    } catch {
      setContent('');
    }
  };

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { loadFile(selected); }, [selected]);

  const handleSave = async (newContent: string): Promise<{ ok: boolean; error?: string }> => {
    const r = await memoryApi.put(SLUG, selected, newContent) as { ok?: true; error?: string };
    if (r && r.ok) {
      setContent(newContent);
      await loadAll();
      return { ok: true };
    }
    return { ok: false, error: r?.error ?? 'Mentés sikertelen.' };
  };

  const handleApprove = async (id: string) => {
    await memoryApi.approveProposal(id);
    await loadAll();
    await loadFile(selected);
  };

  const handleReject = async (id: string) => {
    await memoryApi.rejectProposal(id);
    await loadAll();
  };

  return (
    <div className="grid grid-cols-[240px_1fr] gap-6">
      <aside>
        <h2 className="font-serif text-lg mb-3">Memória</h2>
        <MemoryFileList fileFlags={fileFlags} selected={selected} onSelect={setSelected} />
      </aside>

      <section>
        {proposals.length > 0 && (
          <div className="mb-6">
            <h3 className="font-serif text-base mb-2">Függő javaslatok ({proposals.length})</h3>
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
        <MemoryEditor
          file={selected}
          initialContent={content ?? ''}
          onSave={handleSave}
        />
      </section>
    </div>
  );
}
