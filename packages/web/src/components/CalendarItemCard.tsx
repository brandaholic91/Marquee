import type { CalendarItem } from "../lib/api.js";

const STATUS_LABEL: Record<CalendarItem["status"], string> = {
	planned: "Tervezett",
	brief_created: "Brief kész",
	delivered: "Kész",
	cancelled: "Törölve",
};

export function CalendarItemCard({
	item,
	keyMessageText,
	onEdit,
	onDelete,
	onOpenApprovals,
}: {
	item: CalendarItem;
	keyMessageText?: string | null;
	onEdit: (item: CalendarItem) => void;
	onDelete: (itemId: string) => void;
	onOpenApprovals?: () => void;
}) {
	const daysDiff = Math.ceil((item.targetDate - Date.now()) / (1000 * 60 * 60 * 24));
	const relative = daysDiff === 0 ? "ma" : daysDiff > 0 ? `${daysDiff} nap múlva` : `${Math.abs(daysDiff)} napja`;

	return (
		<div className="border border-rule rounded-lg px-3.5 py-3 bg-off-white flex items-start justify-between gap-3">
			<div className="min-w-0">
				<div className="flex items-center gap-2 flex-wrap">
					<span className="text-[10px] font-semibold px-2 py-0.5 rounded-chip bg-parchment text-ink-2">{item.channel}</span>
					{item.deliverableType && <span className="text-xs text-ink-2">{item.deliverableType}</span>}
					<span className="text-xs text-ink-3">{new Date(item.targetDate).toLocaleDateString("hu-HU")} · {relative}</span>
					{keyMessageText && (
						<span className="text-[10px] font-medium px-2 py-0.5 rounded-chip bg-primary-soft text-primary">
							{keyMessageText.slice(0, 30)}
						</span>
					)}
				</div>
				<p className="text-sm text-ink-1 mt-1">{item.intent}</p>
				<div className="text-[11px] text-ink-3 mt-1">Státusz: {STATUS_LABEL[item.status]}</div>
			</div>
			<div className="flex flex-col gap-1 shrink-0">
				{item.status === "planned" && (
					<>
						<button className="text-xs px-2 py-1 border border-rule rounded hover:bg-parchment" onClick={() => onEdit(item)}>
							Szerkeszt
						</button>
						<button className="text-xs px-2 py-1 border border-rule rounded hover:bg-parchment" onClick={() => onDelete(item.id)}>
							Cancel
						</button>
					</>
				)}
				{item.status === "brief_created" && (
					<button className="text-xs px-2 py-1 border border-rule rounded hover:bg-parchment" onClick={() => onOpenApprovals?.()}>
						Brief megnyitása
					</button>
				)}
				{item.status === "delivered" && (
					<button className="text-xs px-2 py-1 border border-rule rounded hover:bg-parchment" onClick={() => onOpenApprovals?.()}>
						Deliverable megnyitása
					</button>
				)}
			</div>
		</div>
	);
}
