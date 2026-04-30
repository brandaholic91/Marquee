import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
	campaignsApi,
	plansApi,
	threadsApi,
	messagesApi,
	type CampaignDetail,
	type CampaignPlan,
	type CalendarItem,
	type MessageRow,
} from "../lib/api.js";
import { marqueeEvents } from "../lib/sse.js";
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
	const [activeTab, setActiveTab] = useState<"plan" | "chat">("plan");
	const [searchParams, setSearchParams] = useSearchParams();
	const [editingItem, setEditingItem] = useState<CalendarItem | null>(null);
	const [addingItem, setAddingItem] = useState(false);
	const [chatThreadId, setChatThreadId] = useState<string | null>(null);
	const [chatMessages, setChatMessages] = useState<MessageRow[]>([]);
	const [chatInput, setChatInput] = useState("");

	async function reload() {
		const [campaignDetail, planResponse] = await Promise.all([campaignsApi.get(id), plansApi.get(id)]);
		setCampaign(campaignDetail);
		setPlan(planResponse.plan);
		setItems(planResponse.calendar_items);
	}

	useEffect(() => {
		const tab = searchParams.get("tab");
		if (tab === "plan" || tab === "chat") setActiveTab(tab);
	}, [searchParams]);

	useEffect(() => {
		setSearchParams((prev) => {
			const next = new URLSearchParams(prev);
			next.set("tab", activeTab);
			return next;
		});
	}, [activeTab, setSearchParams]);

	useEffect(() => {
		if (!id) return;
		void reload().finally(() => setLoading(false));
	}, [id]);

	useEffect(() => {
		if (!id) return;
		void (async () => {
			const threads = await threadsApi.list({ campaignId: id });
			const threadId = threads[0]?.id ?? (await threadsApi.create("Kampány tervezés", id)).thread_id;
			setChatThreadId(threadId);
			setChatMessages(await messagesApi.list(threadId));
			marqueeEvents.start();
		})();
	}, [id]);

	useEffect(() => {
		if (!chatThreadId) return;
		const unsub = marqueeEvents.on<Record<string, unknown>>("chat_message", (payload) => {
			if ((payload.thread_id as string | undefined) !== chatThreadId) return;
			void messagesApi.list(chatThreadId).then((rows) => setChatMessages(rows));
		});
		return () => {
			unsub();
		};
	}, [chatThreadId]);

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

			<div className="mb-3 flex gap-2">
				<button
					className={`text-xs px-3 py-1.5 rounded border ${activeTab === "plan" ? "bg-primary text-white border-primary" : "border-rule text-ink-2 hover:bg-parchment"}`}
					onClick={() => setActiveTab("plan")}
				>
					Terv
				</button>
				<button
					className={`text-xs px-3 py-1.5 rounded border ${activeTab === "chat" ? "bg-primary text-white border-primary" : "border-rule text-ink-2 hover:bg-parchment"}`}
					onClick={() => setActiveTab("chat")}
				>
					Tervezési chat
				</button>
			</div>

			{activeTab === "plan" ? (
				<>
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
				</>
			) : (
				<div className="border border-rule rounded-lg bg-off-white p-4">
					<div className="space-y-2 max-h-[420px] overflow-auto">
						{chatMessages.map((m) => {
							const parsed = (() => {
								try {
									return JSON.parse(m.contentJson) as { text?: string };
								} catch {
									return { text: "" };
								}
							})();
							return (
								<div key={m.id} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
									<div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${m.sender === "user" ? "bg-primary-soft" : "bg-parchment border border-rule"}`}>
										{parsed.text ?? ""}
									</div>
								</div>
							);
						})}
					</div>
					<div className="mt-3 flex gap-2">
						<input
							className="flex-1 border border-rule rounded-md px-3 py-2 text-sm bg-parchment"
							value={chatInput}
							onChange={(e) => setChatInput(e.target.value)}
							placeholder="Írj a Directornak a kampánytervről..."
						/>
						<button
							className="bg-primary text-sidebar-bg font-bold px-4 py-2 rounded-md disabled:opacity-50 hover:bg-primary-hover"
							disabled={!chatInput.trim() || !chatThreadId}
							onClick={async () => {
								if (!chatThreadId || !chatInput.trim()) return;
								const text = chatInput.trim();
								setChatInput("");
								await messagesApi.post(chatThreadId, text);
							}}
						>
							Küldés
						</button>
					</div>
				</div>
			)}

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
