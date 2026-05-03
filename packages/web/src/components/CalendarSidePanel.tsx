import type { CalendarItem } from '../lib/api.js';
import { useState, useEffect } from 'react';

interface CalendarSidePanelProps {
  item: CalendarItem | null;
  onClose: () => void;
  onSave: (updates: Partial<CalendarItem>) => Promise<void>;
  onDelete: () => Promise<void>;
  campaigns: Map<string, { name: string }>;
}

const CHANNEL_OPTIONS = ['linkedin', 'email', 'blog', 'landing', 'ad', 'other'] as const;
const STATUS_OPTIONS = ['planned', 'brief_created', 'delivered', 'cancelled'] as const;

export function CalendarSidePanel({
  item,
  onClose,
  onSave,
  onDelete,
  campaigns,
}: CalendarSidePanelProps) {
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('09:00');
  const [status, setStatus] = useState<string>('planned');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setTitle(item.intent);
      setChannel(item.channel);
      setDate(new Date(item.targetDate).toISOString().slice(0, 10));
      setTime(item.startTime || '09:00');
      setStatus(item.status);
    }
  }, [item]);

  if (!item) return null;

  const campaign = campaigns.get(item.campaignId);

  const handleSave = async () => {
    setSaving(true);
    try {
      const newDate = new Date(date).getTime();
      await onSave({
        intent: title,
        channel: channel as any,
        targetDate: newDate,
        startTime: time,
        status: status as any,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Biztosan törölni szeretnéd ezt az elemet?')) return;
    setSaving(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-80 bg-white border-l border-rule flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-rule">
        <h2 className="text-lg font-bold text-ink-1">Elem szerkesztése</h2>
        <button
          onClick={onClose}
          className="text-ink-2 hover:text-ink-1 text-2xl leading-none"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {campaign && (
          <div>
            <div className="text-xs font-semibold text-sidebar-muted uppercase">Kampány</div>
            <div className="text-sm text-ink-1">{campaign.name}</div>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-ink-1 mb-1">Cím</label>
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-rule rounded-lg text-sm focus:outline-none focus:border-primary"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink-1 mb-1">Csatorna</label>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="w-full px-3 py-2 border border-rule rounded-lg text-sm focus:outline-none focus:border-primary"
          >
            {CHANNEL_OPTIONS.map((ch) => (
              <option key={ch} value={ch}>
                {ch}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink-1 mb-1">Dátum</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-rule rounded-lg text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink-1 mb-1">Kezdés ideje</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            step="1800"
            className="w-full px-3 py-2 border border-rule rounded-lg text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink-1 mb-1">Státusz</label>
          <div className="flex gap-2">
            {STATUS_OPTIONS.map((st) => (
              <button
                key={st}
                onClick={() => setStatus(st)}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                  status === st
                    ? 'bg-primary text-white'
                    : 'bg-off-white text-ink-2 hover:bg-parchment'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-rule px-6 py-4 flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Mentés...' : 'Mentés'}
        </button>
        <button
          onClick={handleDelete}
          disabled={saving}
          className="flex-1 px-4 py-2 bg-red-100 text-red-800 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
        >
          Törlés
        </button>
      </div>
    </div>
  );
}
