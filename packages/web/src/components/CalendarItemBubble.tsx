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
  planned: 'bg-gray-100 text-gray-800',
  brief_created: 'bg-yellow-100 text-yellow-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

interface CalendarItemBubbleProps {
  item: CalendarItem;
  onClick: () => void;
}

export function CalendarItemBubble({ item, onClick }: CalendarItemBubbleProps) {
  const icon = CHANNEL_ICONS[item.channel] || '📎';
  const truncatedTitle = item.intent.length > 20 ? item.intent.substring(0, 20) + '…' : item.intent;
  const statusColor = STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-800';

  return (
    <button
      onClick={onClick}
      title={item.intent}
      className={`w-full text-left text-xs px-1.5 py-0.5 rounded truncate ${statusColor} hover:opacity-80 transition-opacity`}
    >
      <span className="mr-1">{icon}</span>
      <span className="font-medium truncate">{truncatedTitle}</span>
    </button>
  );
}
