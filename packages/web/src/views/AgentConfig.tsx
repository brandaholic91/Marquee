import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { agentsApi, type AgentConfigPayload, type AgentSkillMeta, type AgentSkillFull } from '../lib/api.js';

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
      <div className="flex items-center gap-3 px-6 py-4 border-b border-rule bg-parchment shrink-0">
        <button
          onClick={() => navigate('/ugynokseg')}
          className="text-xs text-ink-3 hover:text-ink-1 transition-colors"
        >
          ← Ügynökség
        </button>
        <span className="text-rule-strong">|</span>
        <span className="font-semibold text-sm text-ink-1 capitalize">{role}</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-rule bg-parchment shrink-0 px-6">
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
        <div className="mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
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
        className="w-full font-mono text-xs bg-white border border-rule rounded-lg p-3 text-ink-1 placeholder:text-ink-3 resize-y focus:outline-none focus:border-primary/50"
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
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
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
          className="w-full text-xs bg-white border border-rule rounded-lg px-3 py-2 text-ink-1"
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
          className="w-full text-xs bg-white border border-rule rounded-lg px-3 py-2 text-ink-1"
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

// ─── Skillek tab ─────────────────────────────────────────────────────────────

function SkillsTab({ role }: { role: string }) {
  const [skills, setSkills] = useState<AgentSkillMeta[]>([]);
  const [modalSkill, setModalSkill] = useState<AgentSkillFull | 'new' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    agentsApi.listSkills(role).then(setSkills);
  }, [role]);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  function openEdit(name: string) {
    agentsApi.getSkill(role, name).then((s) => setModalSkill(s));
  }

  function openNew() {
    setModalSkill('new');
  }

  async function handleSave(data: AgentSkillFull) {
    try {
      if (modalSkill === 'new') {
        await agentsApi.postSkill(role, data);
      } else {
        await agentsApi.putSkill(role, data.name, { description: data.description, body: data.body });
      }
      setModalSkill(null);
      loadSkills();
    } catch {
      setToast('Mentés sikertelen.');
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function handleDelete(name: string) {
    if (!confirm(`Törlöd a „${name}" skillt? Ez nem visszavonható.`)) return;
    try {
      await agentsApi.deleteSkill(role, name);
      setModalSkill(null);
      loadSkills();
    } catch {
      setToast('Törlés sikertelen.');
      setTimeout(() => setToast(null), 3000);
    }
  }

  return (
    <div>
      {toast && (
        <div className="mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {toast}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {skills.map((s) => (
          <div
            key={s.name}
            className="bg-white border border-rule rounded-card p-3"
          >
            <p className="text-xs font-semibold text-ink-1 mb-1">{s.name}</p>
            <p className="text-xs text-ink-3 line-clamp-2 mb-3">{s.description}</p>
            <button
              onClick={() => openEdit(s.name)}
              className="text-xs font-medium px-3 py-1 rounded bg-parchment text-ink-2 hover:text-ink-1 transition-colors border border-rule"
            >
              Szerkesztés
            </button>
          </div>
        ))}
        {/* New skill card */}
        <button
          onClick={openNew}
          className="border border-dashed border-rule rounded-card p-3 flex items-center justify-center text-xs text-ink-3 hover:border-primary/40 hover:text-ink-1 transition-colors"
        >
          + Új skill
        </button>
      </div>

      {modalSkill !== null && (
        <SkillModal
          initial={modalSkill === 'new' ? { name: '', description: '', body: '' } : modalSkill}
          isNew={modalSkill === 'new'}
          onSave={handleSave}
          onDelete={modalSkill !== 'new' ? () => handleDelete((modalSkill as AgentSkillFull).name) : undefined}
          onClose={() => setModalSkill(null)}
        />
      )}
    </div>
  );
}

function SkillModal({
  initial,
  isNew,
  onSave,
  onDelete,
  onClose,
}: {
  initial: AgentSkillFull;
  isNew: boolean;
  onSave: (data: AgentSkillFull) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [body, setBody] = useState(initial.body);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await onSave({ name, description, body });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-rule rounded-card w-full max-w-lg max-h-[90vh] flex flex-col shadow-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-rule shrink-0">
          <h2 className="text-sm font-semibold text-ink-1">
            {isNew ? 'Új skill' : `Szerkesztés: ${initial.name}`}
          </h2>
          <button onClick={onClose} className="text-ink-3 hover:text-ink-1 text-lg leading-none">×</button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink-3 mb-1 uppercase tracking-wider">
              Skill neve
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              readOnly={!isNew}
              placeholder="pl. brief_parser"
              className="w-full text-xs bg-cream border border-rule rounded-lg px-3 py-2 text-ink-1 placeholder:text-ink-3 font-mono read-only:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-3 mb-1 uppercase tracking-wider">
              Leírás <span className="normal-case font-normal">(description — ez jelenik meg a catalog-ban)</span>
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mikor aktiválja az agent ezt a skillt…"
              className="w-full text-xs bg-cream border border-rule rounded-lg px-3 py-2 text-ink-1 placeholder:text-ink-3"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-3 mb-1 uppercase tracking-wider">
              Body <span className="normal-case font-normal">(instrukciók — on-demand töltődik be)</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              placeholder="Részletes instrukciók az agent számára…"
              className="w-full font-mono text-xs bg-cream border border-rule rounded-lg px-3 py-2 text-ink-1 placeholder:text-ink-3 resize-y"
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-rule shrink-0">
          <div>
            {onDelete && (
              <button
                onClick={onDelete}
                className="text-xs text-red-600 hover:text-red-700 transition-colors"
              >
                Törlés
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-lg border border-rule text-ink-3 hover:text-ink-1 transition-colors"
            >
              Mégse
            </button>
            <button
              onClick={() => { void submit(); }}
              disabled={saving || !name || !description}
              className="text-xs font-medium px-4 py-1.5 rounded-lg bg-primary text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {saving ? 'Mentés…' : 'Mentés'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
