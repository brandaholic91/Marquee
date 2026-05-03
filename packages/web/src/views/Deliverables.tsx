import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deliverablesApi, campaignsApi, type DeliverableRow, type CampaignRow } from "../lib/api.js";

const DELIVERABLE_TYPES = [
  "social_post", "email", "blog_post", "ad_copy", "content_brief_seo", "seo_report",
] as const;

const TYPE_LABEL: Record<string, string> = {
  social_post: "Social poszt",
  email: "Email",
  blog_post: "Blog poszt",
  ad_copy: "Hirdetés szöveg",
  content_brief_seo: "SEO brief",
  seo_report: "SEO riport",
};

const STATUS_PILLS = [
  { value: "shipped", label: "Lezárva" },
  { value: "awaiting_approval", label: "Jóváhagyásra vár" },
  { value: "archived", label: "Eldobott" },
] as const;

type StatusFilter = "shipped" | "awaiting_approval" | "archived";

function periodStart(period: string): number {
  const now = new Date();
  if (period === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  if (period === "week") {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(now.getFullYear(), now.getMonth(), diff).getTime();
  }
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }
  return 0;
}

export function Deliverables() {
  const [rows, setRows] = useState<DeliverableRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("shipped");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");

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

  const filtered = rows.filter((d) => {
    if (d.status !== statusFilter) return false;
    if (typeFilter !== "all" && d.type !== typeFilter) return false;
    if (campaignFilter !== "all" && d.campaignId !== campaignFilter) return false;
    if (periodFilter !== "all" && d.updatedAt < periodStart(periodFilter)) return false;
    return true;
  });

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

      {/* Szűrősáv */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Státusz pill-gombok */}
        <div className="flex gap-1">
          {STATUS_PILLS.map((p) => (
            <button
              key={p.value}
              onClick={() => setStatusFilter(p.value)}
              className={`text-[12px] font-medium px-3 py-1.5 rounded-chip border transition-colors ${
                statusFilter === p.value
                  ? "bg-primary text-sidebar-bg border-primary"
                  : "bg-off-white text-ink-2 border-rule hover:bg-parchment"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Típus dropdown */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-[12px] border border-rule rounded-md px-2 py-1.5 bg-off-white text-ink-2 focus:outline-none focus:border-primary"
        >
          <option value="all">Minden típus</option>
          {DELIVERABLE_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABEL[t]}</option>
          ))}
        </select>

        {/* Kampány dropdown */}
        <select
          value={campaignFilter}
          onChange={(e) => setCampaignFilter(e.target.value)}
          className="text-[12px] border border-rule rounded-md px-2 py-1.5 bg-off-white text-ink-2 focus:outline-none focus:border-primary"
        >
          <option value="all">Minden kampány</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>

        {/* Időszak dropdown */}
        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          className="text-[12px] border border-rule rounded-md px-2 py-1.5 bg-off-white text-ink-2 focus:outline-none focus:border-primary"
        >
          <option value="all">Összes időszak</option>
          <option value="today">Ma</option>
          <option value="week">Ez a hét</option>
          <option value="month">Ez a hónap</option>
        </select>

        <span className="text-[11px] text-ink-3 ml-auto">{filtered.length} elem</span>
      </div>

      {/* Táblázat helye — Task 4-ben */}
      <p className="text-[12px] text-ink-3">{filtered.length} találat</p>
    </div>
  );
}
