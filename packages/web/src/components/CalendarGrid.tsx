import type { CalendarItem } from '../lib/api.js';
import { CalendarWeekly } from './CalendarWeekly.js';
import { CalendarMonthly } from './CalendarMonthly.js';

interface CalendarGridProps {
  items: CalendarItem[];
  viewMode: 'weekly' | 'monthly';
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onItemClick: (item: CalendarItem) => void;
  onItemReschedule: (itemId: string, newDate: number, newTime: string) => void;
}

export function CalendarGrid({
  items,
  viewMode,
  selectedDate,
  onSelectDate,
  onItemClick,
  onItemReschedule,
}: CalendarGridProps) {
  if (viewMode === 'weekly') {
    return (
      <CalendarWeekly
        items={items}
        selectedDate={selectedDate}
        onSelectDate={onSelectDate}
        onItemClick={onItemClick}
        onItemReschedule={onItemReschedule}
      />
    );
  }

  return (
    <CalendarMonthly
      items={items}
      selectedDate={selectedDate}
      onSelectDate={onSelectDate}
      onItemClick={onItemClick}
      onItemReschedule={onItemReschedule}
    />
  );
}
