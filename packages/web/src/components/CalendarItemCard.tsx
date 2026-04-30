import type { CalendarItem } from "../lib/api.js";

const STATUS_LABEL: Record<CalendarItem["status"], string> = {
	planned: "Tervezett",
	brief_created: "Brief kész",
	delivered: "Kész",
	cancelled: "Törölve",
};

export function CalendarItemCard({
	item,
	onDeriveBrief,
	onEdit,
	onDelete,
}: {
	item: CalendarItem;
	onDeriveBrief: (itemId: string) => void;
	onEdit: (item: CalendarItem) => void;
	onDelete: (itemId: string) => void;
}) {
	return (
		<div className="border border-rule rounded-lg px-3.5 py-3 bg-off-white flex items-start justify-between gap-3">
			<div className="min-w-0">
				<div className="flex items-center gap-2 flex-wrap">
					<span className="text-[10px] font-semibold px-2 py-0.5 rounded-chip bg-parchment text-ink-2">{item.channel}</span>
					{item.deliverableType && <span className="text-xs text-ink-2">{item.deliverableType}</span>}
					<span className="text-xs text-ink-3">{new Date(item.targetDate).toLocaleDateString("hu-HU")}</span>
				</div>
				<p className="text-sm text-ink-1 mt-1">{item.intent}</p>
				<div className="text-[11px] text-ink-3 mt-1">Státusz: {STATUS_LABEL[item.status]}</div>
			</div>
			<div className="flex flex-col gap-1 shrink-0">
				<button className="text-xs px-2 py-1 border border-rule rounded hover:bg-parchment" onClick={() => onEdit(item)}>
					Szerkeszt
				</button>
				<button
					className="text-xs px-2 py-1 border border-rule rounded hover:bg-parchment disabled:opacity-50"
					onClick={() => onDeriveBrief(item.id)}
					disabled={item.status !== "planned"}
				>
					Brief
				</button>
				<button className="text-xs px-2 py-1 border border-rule rounded hover:bg-parchment" onClick={() => onDelete(item.id)}>
					Törlés
				</button>
			</div>
		</div>
	);
}
