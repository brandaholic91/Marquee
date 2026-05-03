import { useState } from 'react';

interface CampaignFilterProps {
  campaigns: Array<{ id: string; name: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function CampaignFilter({
  campaigns,
  selectedIds,
  onChange,
}: CampaignFilterProps) {
  const [open, setOpen] = useState(false);

  const handleToggle = (campaignId: string) => {
    if (selectedIds.includes(campaignId)) {
      onChange(selectedIds.filter((id) => id !== campaignId));
    } else {
      onChange([...selectedIds, campaignId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === campaigns.length) {
      onChange([]);
    } else {
      onChange(campaigns.map((c) => c.id));
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-3 py-2 rounded-lg bg-off-white text-ink-2 text-sm font-medium hover:bg-parchment transition-colors"
      >
        Kampányok ({selectedIds.length}/{campaigns.length}) ▼
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 w-48 bg-white border border-rule rounded-lg shadow-lg z-50 p-2">
          <button
            onClick={handleSelectAll}
            className="w-full text-left px-3 py-2 rounded hover:bg-parchment text-sm font-semibold"
          >
            {selectedIds.length === campaigns.length ? 'Összes kijelölésének feloldása' : 'Összes kijelölése'}
          </button>
          <div className="border-t border-rule my-1" />
          {campaigns.map((campaign) => (
            <label key={campaign.id} className="flex items-center px-3 py-2 hover:bg-parchment rounded cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.includes(campaign.id)}
                onChange={() => handleToggle(campaign.id)}
                className="mr-2"
              />
              <span className="text-sm">{campaign.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
