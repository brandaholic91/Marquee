import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { agentsApi, type AgentConfigPayload } from '../lib/api.js';

type Tab = 'identity' | 'skills' | 'settings';

const MODEL_OPTIONS = [
  { value: '', label: '— alapértelmezett —' },
  { value: 'gpt-5.4-mini', label: 'gpt-5.4-mini (fast)' },
  { value: 'gpt-5.4', label: 'gpt-5.4 (balanced)' },
  { value: 'gpt-5.5', label: 'gpt-5.5 (powerful)' },
];

const THINKING_OPTIONS = [
  { value: 'off', label: 'Ki' },
  { value: 'minimal', label: 'Minimális' },
  { value: 'low', label: 'Alacsony' },
  { value: 'medium', label: 'Közepes' },
  { value: 'high', label: 'Magas' },
];

export function AgentConfig() {
  const { role } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('identity');

  if (!role) return null;

  return (
    <div className="flex-1 overflow-auto flex flex-col">
      {/* Topbar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-sidebar-border bg-sidebar-bg shrink-0">
        <button
          onClick={() => navigate('/ugynokseg')}
          className="text-xs text-ink-3 hover:text-ink-1 transition-colors"
        >
          ← Ügynökség
        </button>
        <span className="text-sidebar-border">|</span>
        <span className="font-semibold text-sm text-ink-1 capitalize">{role}</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-sidebar-border bg-sidebar-bg shrink-0 px-6">
        {(['identity', 'skills', 'settings'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-ink-3 hover:text-ink-1'
            }`}
          >
            {t === 'identity' ? 'Identitás' : t === 'skills' ? 'Skillek' : 'Beállítások'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-6">
        {tab === 'identity' && <IdentityTab role={role} />}
        {tab === 'skills' && <SkillsTab role={role} />}
        {tab === 'settings' && <SettingsTab role={role} />}
      </div>
    </div>
  );
}

// ─── Identitás tab ───────────────────────────────────────────────────────────

function IdentityTab({ role }: { role: string }) {
  const [body, setBody] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    agentsApi.getIdentity(role).then((r) => { setBody(r.body); setSaved(r.body); });
  }, [role]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await agentsApi.putIdentity(role, body);
      setSaved(body);
    } catch {
      setToast('Mentés sikertelen.');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const dirty = body !== saved;

  return (
    <div className="max-w-2xl">
      {toast && (
        <div className="mb-3 text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">
          {toast}
        </div>
      )}
      <p className="text-xs text-ink-3 mb-3">
        Az agent személyisége és szerepe. Ez a system prompt első blokkjaként töltődik be.
      </p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={20}
        placeholder={`Te vagy a ${role} agentje ennek az AI marketing ügynökségnek.\n\nÍrd le a szerepét, feladatait és döntéshozatali stílusát.`}
        className="w-full font-mono text-xs bg-sidebar-bg border border-sidebar-border rounded-lg p-3 text-ink-1 placeholder:text-ink-3 resize-y focus:outline-none focus:border-primary/50"
      />
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={() => void handleSave()}
          disabled={saving || !dirty}
          className="text-xs font-medium px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {saving ? 'Mentés…' : 'Mentés'}
        </button>
        {dirty && <span className="text-xs text-ink-3">Nem mentett változások</span>}
      </div>
    </div>
  );
}

// ─── Beállítások tab ─────────────────────────────────────────────────────────

function SettingsTab({ role }: { role: string }) {
  const [model, setModel] = useState('');
  const [thinkingLevel, setThinkingLevel] = useState('off');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    agentsApi.getConfig(role).then((cfg) => {
      setModel(cfg.model ?? '');
      setThinkingLevel(cfg.thinking_level ?? 'off');
    });
  }, [role]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await agentsApi.putConfig(role, {
        model: model || undefined,
        thinking_level: thinkingLevel === 'off' ? undefined : thinkingLevel,
      });
    } catch {
      setToast('Mentés sikertelen.');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-sm space-y-4">
      {toast && (
        <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">
          {toast}
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1.5 uppercase tracking-wider">
          Modell
        </label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full text-xs bg-sidebar-bg border border-sidebar-border rounded-lg px-3 py-2 text-ink-1"
        >
          {MODEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-3 mb-1.5 uppercase tracking-wider">
          Gondolkodási szint
        </label>
        <select
          value={thinkingLevel}
          onChange={(e) => setThinkingLevel(e.target.value)}
          className="w-full text-xs bg-sidebar-bg border border-sidebar-border rounded-lg px-3 py-2 text-ink-1"
        >
          {THINKING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <button
        onClick={() => void handleSave()}
        disabled={saving}
        className="text-xs font-medium px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
      >
        {saving ? 'Mentés…' : 'Mentés'}
      </button>
    </div>
  );
}

// ─── Skillek tab placeholder (implemented in Task 12) ────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SkillsTab({ role: _role }: { role: string }) {
  return (
    <div className="text-xs text-ink-3">Skillek — következő task</div>
  );
}
