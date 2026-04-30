import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { campaignsApi, plansApi, type CampaignDetail, type CampaignPlan, type CalendarItem } from "../lib/api.js";
import { PlanEditor } from "../components/PlanEditor.js";
import { CalendarItemCard } from "../components/CalendarItemCard.js";
import { CalendarItemEditModal } from "../components/CalendarItemEditModal.js";

export function CampaignDetail() {
	const { id = "" } = useParams();
	const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
	const [plan, setPlan] = useState<CampaignPlan | null>(null);
	const [items, setItems] = useState<CalendarItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [editingItem, setEditingItem] = useState<CalendarItem | null>(null);
	const [addingItem, setAddingItem] = useState(false);

	async function reload() {
		const [campaignDetail, planResponse] = await Promise.all([campaignsApi.get(id), plansApi.get(id)]);
		setCampaign(campaignDetail);
		setPlan(planResponse.plan);
		setItems(planResponse.calendar_items);
	}

	useEffect(() => {
		if (!id) return;
		void reload().finally(() => setLoading(false));
	}, [id]);

	if (loading) return <p className="text-ink-2 text-sm py-8 px-5">Betöltés…</p>;
	if (!campaign) return <p className="text-red-600 text-sm py-8 px-5">Kampány nem található.</p>;

	return (
		<div className="flex-1 overflow-auto p-5 pb-14 md:pb-5">
			<div className="mb-4 flex items-center justify-between gap-3">
				<div>
					<Link to="/kampanyok" className="text-xs text-primary hover:underline">
						← Kampányok
					</Link>
					<h1 className="text-xl font-bold text-ink-1 mt-1">{campaign.title}</h1>
				</div>
			</div>

			<PlanEditor
				initial={plan}
				busy={saving}
				onSave={async (form) => {
					setSaving(true);
					await plansApi.put(id, form);
					await reload();
					setSaving(false);
				}}
			/>

			<div className="mt-4 border border-rule rounded-lg bg-off-white p-4">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-semibold text-ink-1">Calendar</h2>
					<button className="text-xs px-3 py-1.5 rounded border border-rule text-ink-2 hover:bg-parchment" onClick={() => setAddingItem(true)}>
						Item hozzáadása
					</button>
				</div>
				<div className="mt-3 space-y-2">
					{items.length === 0 ? (
						<p className="text-sm text-ink-2">Még nincs calendar item.</p>
					) : (
						items.map((item) => (
							<CalendarItemCard
								key={item.id}
								item={item}
								onEdit={(current) => setEditingItem(current)}
								onDeriveBrief={(itemId) => void plansApi.deriveBrief(id, itemId)}
								onDelete={(itemId) => void plansApi.deleteCalendarItem(id, itemId).then(() => reload())}
							/>
						))
					)}
				</div>
			</div>

			{(addingItem || editingItem) && (
				<CalendarItemEditModal
					initial={editingItem}
					onClose={() => {
						setAddingItem(false);
						setEditingItem(null);
					}}
					onSave={async (payload) => {
						if (editingItem) {
							await plansApi.updateCalendarItem(id, editingItem.id, payload);
						} else {
							await plansApi.createCalendarItem(id, payload);
						}
						setAddingItem(false);
						setEditingItem(null);
						await reload();
					}}
				/>
			)}
		</div>
	);
}
