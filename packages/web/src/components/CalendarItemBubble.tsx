import type { CalendarItem } from '../lib/api.js';

const CHANNEL_ICONS: Record<string, string> = {
  linkedin: '💼',
  email: '📧',
  blog: '📝',
  landing: '🎯',
  ad: '💰',
  other: '📎',
};

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-parchment text-ink-2',
  brief_created: 'bg-primary-soft text-primary-deep',
  delivered: 'bg-success-soft text-success-deep',
  cancelled: 'bg-danger-soft text-danger-deep',
};

interface CalendarItemBubbleProps {
  item: CalendarItem;
  onClick: () => void;
}

export function CalendarItemBubble({ item, onClick }: CalendarItemBubbleProps) {
  const icon = CHANNEL_ICONS[item.channel] || '📎';
  const statusColor = STATUS_COLORS[item.status] || 'bg-parchment text-ink-2';

  return (
    <button
      onClick={onClick}
      title={item.intent}
      aria-label={`${item.channel} channel: ${item.intent} - Status: ${item.status}`}
      className={`w-full text-left text-xs px-1.5 py-0.5 rounded truncate ${statusColor} hover:opacity-80 transition-opacity`}
    >
      <span className="mr-1">{icon}</span>
      <span className="font-medium truncate">{item.intent}</span>
    </button>
  );
}
