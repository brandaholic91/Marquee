import { useState } from "react";
import type { CalendarItem } from "../lib/api.js";

export function CalendarItemEditModal({
	initial,
	keyMessages,
	onClose,
	onSave,
}: {
	initial: CalendarItem | null;
	keyMessages: Array<{ id: string; text: string }>;
	onClose: () => void;
	onSave: (payload: {
		channel: CalendarItem["channel"];
		deliverable_type: string | null;
		target_date: number;
		intent: string;
		key_message_ref: string | null;
	}) => Promise<void>;
}) {
	const [channel, setChannel] = useState<CalendarItem["channel"]>(initial?.channel ?? "linkedin");
	const [deliverableType, setDeliverableType] = useState(initial?.deliverableType ?? "");
	const [targetDate, setTargetDate] = useState(
		initial ? new Date(initial.targetDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
	);
	const [intent, setIntent] = useState(initial?.intent ?? "");
	const [keyMessageRef, setKeyMessageRef] = useState(initial?.keyMessageRef ?? "");

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
			<div className="bg-parchment rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 flex flex-col gap-4">
				<h2 className="text-lg font-semibold">Calendar item {initial ? "szerkesztése" : "hozzáadása"}</h2>
				<select
					className="w-full border border-rule rounded-md px-3 py-2 text-sm bg-off-white"
					value={channel}
					onChange={(e) => setChannel(e.target.value as CalendarItem["channel"])}
				>
					<option value="linkedin">LinkedIn</option>
					<option value="email">Email</option>
					<option value="blog">Blog</option>
					<option value="landing">Landing</option>
					<option value="ad">Ad</option>
					<option value="other">Other</option>
				</select>
				<input
					className="w-full border border-rule rounded-md px-3 py-2 text-sm bg-off-white"
					placeholder="Deliverable típus (pl. social_post)"
					value={deliverableType}
					onChange={(e) => setDeliverableType(e.target.value)}
				/>
				<input
					type="date"
					className="w-full border border-rule rounded-md px-3 py-2 text-sm bg-off-white"
					value={targetDate}
					onChange={(e) => setTargetDate(e.target.value)}
				/>
				<textarea
					className="w-full border border-rule rounded-md px-3 py-2 text-sm bg-off-white min-h-24"
					placeholder="Szándék"
					value={intent}
					onChange={(e) => setIntent(e.target.value)}
				/>
				<select
					className="w-full border border-rule rounded-md px-3 py-2 text-sm bg-off-white"
					value={keyMessageRef}
					onChange={(e) => setKeyMessageRef(e.target.value)}
				>
					<option value="">Nincs key message ref</option>
					{keyMessages.map((km) => (
						<option key={km.id} value={km.id}>
							{km.text}
						</option>
					))}
				</select>
				<div className="flex gap-2 justify-end">
					<button className="px-4 py-2 rounded-md text-sm text-ink-2 hover:bg-cream" onClick={onClose}>
						Mégse
					</button>
					<button
						className="px-4 py-2 rounded-md text-sm bg-primary text-white hover:bg-primary-hover"
						onClick={() =>
							void onSave({
								channel,
								deliverable_type: deliverableType.trim() || null,
								target_date: new Date(`${targetDate}T00:00:00`).getTime(),
								intent,
								key_message_ref: keyMessageRef || null,
							})
						}
					>
						Mentés
					</button>
				</div>
			</div>
		</div>
	);
}
