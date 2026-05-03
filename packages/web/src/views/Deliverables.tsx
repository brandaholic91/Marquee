import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deliverablesApi, campaignsApi, type DeliverableRow, type CampaignRow } from "../lib/api.js";

export function Deliverables() {
  const [rows, setRows] = useState<DeliverableRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      deliverablesApi.list(),
      campaignsApi.list(),
    ]).then(([dels, camps]) => {
      setRows(Array.isArray(dels) ? dels : []);
      setCampaigns(Array.isArray(camps) ? camps : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const campaignName = (id: string | null): string => {
    if (!id) return "—";
    return campaigns.find((c) => c.id === id)?.title ?? "—";
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[13px] text-ink-3">Betöltés…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden p-6">
      <h1 className="text-[18px] font-bold text-ink-1 mb-4">Deliverables</h1>
      <p className="text-[12px] text-ink-3">{rows.length} elem betöltve</p>
    </div>
  );
}
