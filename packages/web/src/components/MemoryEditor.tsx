import { useEffect, useState } from 'react';

const FILE_LABELS: Record<string, string> = {
  'profile.md': 'Ügyfélprofil',
  'brand_voice.md': 'Brand voice',
  'ongoing_campaigns.md': 'Aktív kampányok',
};

export function MemoryEditor({
  file, initialContent, onSave,
}: {
  file: string;
  initialContent: string;
  onSave: (content: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setContent(initialContent);
    setError(null);
    setSaved(false);
  }, [file, initialContent]);

  const dirty = content !== initialContent;

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <h3 className="font-sans font-semibold text-lg">{FILE_LABELS[file] ?? file}</h3>
        {saved && !dirty && <span className="text-xs text-success-deep">Mentve</span>}
        {dirty && <span className="text-xs text-ink-2">Módosított</span>}
      </div>
      <textarea
        className="w-full border border-rule-strong rounded-md p-3 min-h-[400px] font-mono text-sm bg-off-white"
        value={content}
        onChange={(e) => { setContent(e.target.value); setSaved(false); }}
      />
      {error && (
        <div className="mt-2 p-2 bg-danger-soft text-danger-deep rounded-md text-sm">
          {error}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button
          className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-hover disabled:opacity-50"
          disabled={!dirty || saving}
          onClick={async () => {
            setSaving(true); setError(null);
            const r = await onSave(content);
            setSaving(false);
            if (r.ok) { setSaved(true); }
            else { setError(r.error ?? 'Mentés sikertelen.'); }
          }}
        >
          {saving ? 'Mentés…' : 'Mentés'}
        </button>
      </div>
    </div>
  );
}
