import { useMemo } from 'react';
import type { CalendarItem } from '../lib/api.js';
import { CalendarItemBubble } from './CalendarItemBubble.js';

interface CalendarMonthlyProps {
  items: CalendarItem[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onItemClick: (item: CalendarItem) => void;
  onItemReschedule: (itemId: string, newDate: number, newTime: string) => void;
}

export function CalendarMonthly({
  items,
  selectedDate,
  onSelectDate,
  onItemClick,
  onItemReschedule,
}: CalendarMonthlyProps) {
  // Get the start of the month
  const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);

  // Get calendar grid boundaries (Monday to Sunday)
  const calendarStart = new Date(monthStart);
  const dayOfWeek = calendarStart.getDay();
  const daysBack = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  calendarStart.setDate(calendarStart.getDate() - daysBack);
  calendarStart.setHours(0, 0, 0, 0);

  const calendarEnd = new Date(monthEnd);
  const endDayOfWeek = calendarEnd.getDay();
  const daysAhead = endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek;
  calendarEnd.setDate(calendarEnd.getDate() + daysAhead);

  // Generate all days in the calendar grid
  const days: Date[] = [];
  const currentDay = new Date(calendarStart);
  while (currentDay <= calendarEnd) {
    days.push(new Date(currentDay));
    currentDay.setDate(currentDay.getDate() + 1);
  }

  // Group items by date
  const itemsByDate = useMemo(() => {
    const map: Record<number, CalendarItem[]> = {};
    items.forEach((item) => {
      const itemDate = new Date(item.targetDate);
      itemDate.setHours(0, 0, 0, 0);
      const dateKey = itemDate.getTime();
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(item);
    });
    return map;
  }, [items]);

  // Split days into weeks
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const formatDayName = (date: Date) => {
    const names = ['Vas', 'Pon', 'Ked', 'Sze', 'Cso', 'Pén', 'Szo'];
    return names[date.getDay()];
  };

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      {/* Header: Day names */}
      <div className="grid grid-cols-7 gap-px bg-sidebar-bg border-b border-rule sticky top-0 z-10">
        {['Pon', 'Ked', 'Sze', 'Cso', 'Pén', 'Szo', 'Vas'].map((day) => (
          <div key={day} className="p-2 text-center text-xs font-semibold text-sidebar-muted">
            {day}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="flex-1">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 gap-px border-b border-rule h-24">
            {week.map((day) => {
              const dayItems = itemsByDate[day.getTime()] || [];
              const isCurrentMonth = day.getMonth() === monthStart.getMonth();

              return (
                <div
                  key={day.getTime()}
                  className={`p-1 border-r border-rule cursor-pointer transition-colors ${
                    isCurrentMonth ? 'bg-white hover:bg-parchment' : 'bg-off-white hover:bg-parchment'
                  }`}
                  onClick={() => onSelectDate(day)}
                >
                  <div className="text-sm font-semibold text-ink-1 mb-1">{day.getDate()}</div>
                  <div className="space-y-0.5 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                    {dayItems.slice(0, 3).map((item) => (
                      <CalendarItemBubble
                        key={item.id}
                        item={item}
                        onClick={() => onItemClick(item)}
                      />
                    ))}
                    {dayItems.length > 3 && (
                      <button
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                          e.stopPropagation();
                          onSelectDate(day);
                        }}
                        className="text-xs text-primary font-semibold hover:opacity-80"
                      >
                        +{dayItems.length - 3} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
