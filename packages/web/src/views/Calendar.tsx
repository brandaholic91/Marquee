import { useEffect, useState } from 'react';
import { useMarqueeStore } from '../store/useMarqueeStore.js';
import { CalendarGrid } from '../components/CalendarGrid.js';
import { CalendarSidePanel } from '../components/CalendarSidePanel.js';
import { CampaignFilter } from '../components/CampaignFilter.js';
import { campaignsApi, plansApi, type CalendarItem } from '../lib/api.js';

export function Calendar() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([]);
  const [campaignsMap, setCampaignsMap] = useState(new Map());

  const calendarItems = useMarqueeStore((s) => s.calendarItems);
  const selectedCampaigns = useMarqueeStore((s) => s.selectedCampaigns);
  const viewMode = useMarqueeStore((s) => s.viewMode);
  const selectedDate = useMarqueeStore((s) => s.selectedDate);
  const editingItem = useMarqueeStore((s) => s.editingItem);

  const setCalendarItems = useMarqueeStore((s) => s.setCalendarItems);
  const setSelectedCampaigns = useMarqueeStore((s) => s.setSelectedCampaigns);
  const setViewMode = useMarqueeStore((s) => s.setViewMode);
  const setSelectedDate = useMarqueeStore((s) => s.setSelectedDate);
  const setEditingItem = useMarqueeStore((s) => s.setEditingItem);

  // Fetch campaigns on mount
  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const list = await campaignsApi.list();
        const campaignsList = list.map((c) => ({ id: c.id, name: c.title }));
        setCampaigns(campaignsList);
        const cMap = new Map(campaignsList.map((c) => [c.id, { name: c.name }]));
        setCampaignsMap(cMap);

        // Default: select all
        const allIds = list.map((c) => c.id);
        setSelectedCampaigns(allIds);

        // Fetch calendar items for all campaigns
        const allItems: CalendarItem[] = [];
        for (const campaignId of allIds) {
          try {
            const data = await plansApi.get(campaignId);
            if (data.calendar_items) {
              allItems.push(...data.calendar_items);
            }
          } catch (error) {
            console.error(`Failed to fetch calendar items for campaign ${campaignId}:`, error);
          }
        }
        setCalendarItems(allItems);
      } catch (error) {
        console.error('Failed to fetch calendar data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, [setCalendarItems, setSelectedCampaigns]);

  // Re-fetch calendar items when selected campaigns change
  useEffect(() => {
    const fetchSelectedItems = async () => {
      if (selectedCampaigns.length === 0) {
        setCalendarItems([]);
        return;
      }

      const allItems: CalendarItem[] = [];
      for (const campaignId of selectedCampaigns) {
        try {
          const data = await plansApi.get(campaignId);
          if (data.calendar_items) {
            allItems.push(...data.calendar_items);
          }
        } catch (error) {
          console.error(`Failed to fetch items for campaign ${campaignId}:`, error);
        }
      }
      setCalendarItems(allItems);
    };

    if (selectedCampaigns.length > 0) {
      fetchSelectedItems();
    }
  }, [selectedCampaigns, setCalendarItems]);

  const handleReschedule = async (itemId: string, newDate: number, newTime: string) => {
    if (!editingItem) return;

    try {
      await plansApi.updateCalendarItem(editingItem.campaignId, itemId, {
        target_date: newDate,
      });

      const updated = calendarItems.map((item) =>
        item.id === itemId ? { ...item, targetDate: newDate, startTime: newTime } : item
      );
      setCalendarItems(updated);
    } catch (error) {
      console.error('Failed to reschedule item:', error);
    }
  };

  const handleItemUpdate = async (updates: Partial<CalendarItem>) => {
    if (!editingItem) return;

    try {
      await plansApi.updateCalendarItem(editingItem.campaignId, editingItem.id, {
        target_date: updates.targetDate,
        intent: updates.intent,
        channel: updates.channel,
      });

      const updated = calendarItems.map((item) =>
        item.id === editingItem.id ? { ...item, ...updates } : item
      );
      setCalendarItems(updated);
    } catch (error) {
      console.error('Failed to update item:', error);
    }
  };

  const handleItemDelete = async () => {
    if (!editingItem) return;

    try {
      await plansApi.deleteCalendarItem(editingItem.campaignId, editingItem.id);
      setCalendarItems(calendarItems.filter((item) => item.id !== editingItem.id));
      setEditingItem(null);
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-ink-2">Naptár betöltése...</div>;
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Toolbar */}
      <div className="px-6 py-4 border-b border-rule flex items-center gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('weekly')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              viewMode === 'weekly'
                ? 'bg-primary text-white'
                : 'bg-off-white text-ink-2 hover:bg-parchment'
            }`}
          >
            Heti
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              viewMode === 'monthly'
                ? 'bg-primary text-white'
                : 'bg-off-white text-ink-2 hover:bg-parchment'
            }`}
          >
            Havi
          </button>
        </div>

        <CampaignFilter
          campaigns={campaigns}
          selectedIds={selectedCampaigns}
          onChange={setSelectedCampaigns}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-w-0 overflow-hidden">
        <CalendarGrid
          items={calendarItems}
          viewMode={viewMode}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onItemClick={setEditingItem}
          onItemReschedule={handleReschedule}
        />

        {editingItem && (
          <CalendarSidePanel
            item={editingItem}
            onClose={() => setEditingItem(null)}
            onSave={handleItemUpdate}
            onDelete={handleItemDelete}
            campaigns={campaignsMap}
          />
        )}
      </div>
    </div>
  );
}
