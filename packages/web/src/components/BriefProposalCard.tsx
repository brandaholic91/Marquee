import { useState, useEffect } from 'react';
import { useMarqueeStore } from '../store/useMarqueeStore.js';
import { briefsApi, campaignsApi, type CampaignRow } from '../lib/api.js';
import { MarkdownView } from './MarkdownView.js';
import { MarkdownEditor } from './MarkdownEditor.js';
import { roleLabel } from '../lib/roles.js';

export function BriefProposalCard({
  briefId,
  title,
  contentMd,
  deliverableType,
  targetSpecialist,
  platform,
  campaignName: initialCampaignName,
}: {
  briefId: string;
  title: string;
  contentMd: string;
  deliverableType: string;
  targetSpecialist: string;
  platform?: string | null;
  campaignName?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editContent, setEditContent] = useState(contentMd);
  const [campaignInput, setCampaignInput] = useState(initialCampaignName ?? '');
  const [existingCampaigns, setExistingCampaigns] = useState<CampaignRow[]>([]);
  const dispatchBrief = useMarqueeStore((s) => s.dispatchBrief);
  const discardBrief = useMarqueeStore((s) => s.discardBrief);
  const updateBrief = useMarqueeStore((s) => s.updateBrief);

  useEffect(() => { setEditTitle(title); setEditContent(contentMd); }, [title, contentMd]);
  useEffect(() => {
    campaignsApi.list().then((rows) => setExistingCampaigns(rows.filter((c) => c.status === 'active')));
  }, []);

  const handleDispatch = async () => {
    setBusy(true);
    // Ha a kampány megváltozott, frissítjük dispatch előtt
    const trimmed = campaignInput.trim();
    const original = initialCampaignName ?? '';
    if (trimmed !== original) {
      await briefsApi.update(briefId, { campaign_name: trimmed || null });
    }
    await dispatchBrief(briefId);
    setBusy(false);
  };

  return (
    <>
    {editing && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-parchment rounded-xl shadow-xl w-full max-w-xl mx-4 p-6 flex flex-col gap-4">
          <h2 className="font-serif text-lg font-semibold">Brief szerkesztése</h2>

          <div>
            <label className="text-xs font-medium text-ink-2 uppercase tracking-wide">Cím</label>
            <input
              className="mt-1 w-full border border-rule rounded-md px-3 py-2 text-sm bg-off-white focus:outline-none focus:border-primary"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-ink-2 uppercase tracking-wide">Tartalom</label>
            <div className="mt-1">
              <MarkdownEditor value={editContent} onChange={setEditContent} minHeight="220px" />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              className="px-4 py-2 rounded-md text-sm text-ink-2 hover:bg-cream"
              onClick={() => { setEditing(false); setEditTitle(title); setEditContent(contentMd); }}
            >
              Mégse
            </button>
            <button
              className="px-4 py-2 rounded-md text-sm bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await updateBrief(briefId, editTitle, editContent);
                setBusy(false);
                setEditing(false);
              }}
            >
              Mentés
            </button>
          </div>
        </div>
      </div>
    )}
    <div className="border-2 border-primary rounded-lg p-6 bg-off-white my-3">
      <h3 className="font-serif text-lg font-semibold">{title}</h3>
      <div className="text-sm text-ink-2 mt-1">
        Deliverable: <strong>{deliverableType}</strong>
        {platform && <span> · platform: {platform}</span>}
        <br />
        Specialista: <strong>{roleLabel(targetSpecialist)}</strong>
      </div>

      {/* Kampány hozzárendelés */}
      <div className="mt-3">
        <label className="text-xs font-medium text-ink-2 uppercase tracking-wide">Kampány</label>
        <input
          list={`campaigns-${briefId}`}
          className="mt-1 w-full border border-rule rounded-md px-3 py-2 text-sm bg-parchment focus:outline-none focus:border-primary"
          placeholder="Kampány neve (opcionális)…"
          value={campaignInput}
          onChange={(e) => setCampaignInput(e.target.value)}
        />
        <datalist id={`campaigns-${briefId}`}>
          {existingCampaigns.map((c) => (
            <option key={c.id} value={c.title} />
          ))}
        </datalist>
      </div>

      {contentMd && (
        <div className="mt-3">
          <button
            className="text-xs text-primary-hover hover:underline"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? '▲ Brief elrejtése' : '▼ Brief megtekintése'}
          </button>
          {expanded && (
            <div className="mt-2 bg-cream border border-rule rounded p-4 max-h-64 overflow-y-auto">
              <MarkdownView content={contentMd} />
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button
          className="bg-primary text-white px-4 py-2 rounded-md disabled:opacity-50 hover:bg-primary-hover"
          disabled={busy}
          onClick={handleDispatch}
        >
          Jóváhagy &amp; dispatch
        </button>
        <button
          className="border border-rule-strong px-4 py-2 rounded-md text-ink-1 hover:bg-cream"
          disabled={busy}
          onClick={() => setEditing(true)}
        >
          Szerkeszt
        </button>
        <button
          className="px-3 py-2 rounded-md text-ink-2 hover:bg-cream"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await discardBrief(briefId);
            setBusy(false);
          }}
        >
          Eldob
        </button>
      </div>
    </div>
    </>
  );
}
