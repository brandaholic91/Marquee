import { useMemo } from 'react';
import type { CalendarItem } from '../lib/api.js';
import { CalendarItemBubble } from './CalendarItemBubble.js';

const WORK_HOURS = Array.from({ length: 25 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const minutes = (i % 2) * 30;
  return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
});

interface CalendarWeeklyProps {
  items: CalendarItem[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onItemClick: (item: CalendarItem) => void;
  onItemReschedule: (itemId: string, newDate: number, newTime: string) => void;
}

export function CalendarWeekly({
  items,
  selectedDate,
  onSelectDate,
  onItemClick,
  onItemReschedule,
}: CalendarWeeklyProps) {
  // Get the start of the week (Monday)
  const weekStart = new Date(selectedDate);
  const dayOfWeek = weekStart.getDay();
  const daysBack = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  weekStart.setDate(weekStart.getDate() - daysBack);
  weekStart.setHours(0, 0, 0, 0);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    return day;
  });

  const itemsByTimeSlot = useMemo(() => {
    const slots: Record<string, Record<number, CalendarItem[]>> = {};
    WORK_HOURS.forEach((time) => {
      slots[time] = {};
      weekDays.forEach((day) => {
        slots[time][day.getTime()] = [];
      });
    });

    items.forEach((item) => {
      const itemDate = new Date(item.targetDate);
      itemDate.setHours(0, 0, 0, 0);
      const dateKey = itemDate.getTime();
      const timeSlot = item.startTime || '09:00';
      if (slots[timeSlot] && slots[timeSlot][dateKey]) {
        slots[timeSlot][dateKey].push(item);
      }
    });

    return slots;
  }, [items, weekDays]);

  const formatDayName = (date: Date) => {
    const names = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'];
    return names[date.getDay()];
  };

  const formatDayNum = (date: Date) => {
    return String(date.getDate()).padStart(2, '0');
  };

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      {/* Header: Day names */}
      <div className="sticky top-0 z-10 grid grid-cols-8 gap-px bg-sidebar-bg border-b border-rule">
        <div className="w-20 p-2 text-xs font-semibold text-sidebar-muted">Óra</div>
        {weekDays.map((day) => (
          <div key={day.getTime()} className="p-2 text-center">
            <div className="text-xs font-semibold text-ink-1">{formatDayName(day)}</div>
            <div className="text-sm text-ink-2">{formatDayNum(day)}</div>
          </div>
        ))}
      </div>

      {/* Time slots */}
      <div className="flex-1">
        {WORK_HOURS.map((time) => (
          <div key={time} className="grid grid-cols-8 gap-px border-b border-rule">
            <div className="w-20 p-2 text-xs font-mono text-sidebar-muted">{time}</div>
            {weekDays.map((day) => (
              <div
                key={`${day.getTime()}-${time}`}
                className="min-h-12 p-1 bg-white border-r border-rule hover:bg-parchment cursor-pointer"
                onClick={() => onSelectDate(day)}
              >
                {itemsByTimeSlot[time][day.getTime()].map((item) => (
                  <CalendarItemBubble
                    key={item.id}
                    item={item}
                    onClick={() => onItemClick(item)}
                  />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
