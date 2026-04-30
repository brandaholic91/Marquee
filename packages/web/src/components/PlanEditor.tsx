import { useEffect, useMemo, useState } from "react";
import type { CampaignPlan } from "../lib/api.js";

export type PlanForm = {
	goal: string;
	goal_type: CampaignPlan["goalType"];
	audience: string;
	key_messages: Array<{ id: string; text: string }>;
	channel_mix: Array<{ channel: string; weight: number; note?: string }>;
	timeline_start: number | null;
	timeline_end: number | null;
	kpi: string;
};

const CHANNEL_OPTIONS = ["linkedin", "email", "blog", "landing", "ad", "other"] as const;

function toForm(initial: CampaignPlan | null): PlanForm {
	return {
		goal: initial?.goal ?? "",
		goal_type: initial?.goalType ?? "other",
		audience: initial?.audience ?? "",
		key_messages: initial?.keyMessages ?? [],
		channel_mix: initial?.channelMix ?? [],
		timeline_start: initial?.timelineStart ?? null,
		timeline_end: initial?.timelineEnd ?? null,
		kpi: initial?.kpi ?? "",
	};
}

function slugify(input: string): string {
	return input
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.slice(0, 20) || "uzenet";
}

function dateInputValue(ts: number | null): string {
	if (!ts) return "";
	return new Date(ts).toISOString().slice(0, 10);
}

export function PlanEditor({
	initial,
	busy,
	onSave,
	onStartPlanning,
	onCreateEmptyPlan,
}: {
	initial: CampaignPlan | null;
	busy?: boolean;
	onSave: (form: PlanForm) => Promise<void>;
	onStartPlanning?: () => void;
	onCreateEmptyPlan?: () => Promise<void>;
}) {
	const [form, setForm] = useState<PlanForm>(() => toForm(initial));
	const [newKeyMessage, setNewKeyMessage] = useState("");

	useEffect(() => {
		setForm(toForm(initial));
	}, [initial]);

	const baseline = useMemo(() => JSON.stringify(toForm(initial)), [initial]);
	const isDirty = JSON.stringify(form) !== baseline;
	const weightTotal = form.channel_mix.reduce((sum, row) => sum + row.weight, 0);

	if (initial === null) {
		return (
			<div className="space-y-3 rounded-lg border border-rule bg-off-white p-4">
				<p className="text-sm text-ink-2">Ehhez a kampányhoz még nincs terv.</p>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={onStartPlanning}
						className="bg-primary text-sidebar-bg font-bold px-4 py-2 rounded-md hover:bg-primary-hover"
					>
						Tervezés Director-ral
					</button>
					<button
						type="button"
						onClick={() => void onCreateEmptyPlan?.()}
						className="text-xs px-3 py-1.5 rounded border border-rule text-ink-2 hover:bg-parchment"
					>
						Üres terv létrehozása
					</button>
				</div>
			</div>
		);
	}

	return (
		<form
			className="space-y-3 rounded-lg border border-rule bg-off-white p-4"
			onSubmit={(e) => {
				e.preventDefault();
				void onSave(form);
			}}
		>
			<div>
				<label className="text-xs font-medium text-ink-2 uppercase tracking-wide">Kampánycél</label>
				<textarea
					className="mt-1 w-full border border-rule rounded-md px-3 py-2 text-sm bg-parchment"
					value={form.goal}
					onChange={(e) => setForm((s) => ({ ...s, goal: e.target.value }))}
				/>
			</div>
			<div>
				<label className="text-xs font-medium text-ink-2 uppercase tracking-wide">Cél típusa</label>
				<select
					className="mt-1 w-full border border-rule rounded-md px-3 py-2 text-sm bg-parchment"
					value={form.goal_type}
					onChange={(e) => setForm((s) => ({ ...s, goal_type: e.target.value as PlanForm["goal_type"] }))}
				>
					<option value="lead-gen">Lead gen</option>
					<option value="awareness">Awareness</option>
					<option value="nurture">Nurture</option>
					<option value="activation">Activation</option>
					<option value="retention">Retention</option>
					<option value="other">Egyéb</option>
				</select>
			</div>
			<div>
				<label className="text-xs font-medium text-ink-2 uppercase tracking-wide">Audience</label>
				<textarea
					className="mt-1 w-full border border-rule rounded-md px-3 py-2 text-sm bg-parchment min-h-20"
					value={form.audience}
					onChange={(e) => setForm((s) => ({ ...s, audience: e.target.value }))}
				/>
			</div>
			<div>
				<label className="text-xs font-medium text-ink-2 uppercase tracking-wide">Key message-ek</label>
				<div className="mt-1 space-y-1">
					{form.key_messages.map((row, index) => (
						<div key={row.id} className="flex items-center gap-1">
							<input
								className="flex-1 border border-rule rounded-md px-2 py-1 text-sm bg-parchment"
								value={row.text}
								onChange={(e) =>
									setForm((s) => ({
										...s,
										key_messages: s.key_messages.map((km, i) => (i === index ? { ...km, text: e.target.value } : km)),
									}))
								}
							/>
							<button
								type="button"
								onClick={() =>
									setForm((s) => {
										if (index === 0) return s;
										const next = [...s.key_messages];
										[next[index - 1], next[index]] = [next[index], next[index - 1]];
										return { ...s, key_messages: next };
									})
								}
								className="text-xs px-2 py-1 border border-rule rounded"
							>
								↑
							</button>
							<button
								type="button"
								onClick={() =>
									setForm((s) => {
										if (index === s.key_messages.length - 1) return s;
										const next = [...s.key_messages];
										[next[index], next[index + 1]] = [next[index + 1], next[index]];
										return { ...s, key_messages: next };
									})
								}
								className="text-xs px-2 py-1 border border-rule rounded"
							>
								↓
							</button>
							<button
								type="button"
								onClick={() => setForm((s) => ({ ...s, key_messages: s.key_messages.filter((_, i) => i !== index) }))}
								className="text-xs px-2 py-1 border border-rule rounded"
							>
								×
							</button>
						</div>
					))}
				</div>
				<div className="mt-2 flex gap-2">
					<input
						className="flex-1 border border-rule rounded-md px-2 py-1 text-sm bg-parchment"
						value={newKeyMessage}
						onChange={(e) => setNewKeyMessage(e.target.value)}
						placeholder="Új key message"
					/>
					<button
						type="button"
						onClick={() => {
							const text = newKeyMessage.trim();
							if (!text) return;
							setForm((s) => ({ ...s, key_messages: [...s.key_messages, { id: slugify(text), text }] }));
							setNewKeyMessage("");
						}}
						className="text-xs px-3 py-1.5 rounded border border-rule text-ink-2 hover:bg-parchment"
					>
						Hozzáad
					</button>
				</div>
			</div>
			<div>
				<label className="text-xs font-medium text-ink-2 uppercase tracking-wide">Channel mix</label>
				<div className="mt-1 space-y-1">
					{form.channel_mix.map((row, index) => (
						<div key={`${row.channel}-${index}`} className="flex items-center gap-1">
							<select
								className="border border-rule rounded-md px-2 py-1 text-sm bg-parchment"
								value={row.channel}
								onChange={(e) =>
									setForm((s) => ({
										...s,
										channel_mix: s.channel_mix.map((cm, i) =>
											i === index ? { ...cm, channel: e.target.value } : cm,
										),
									}))
								}
							>
								{CHANNEL_OPTIONS.map((opt) => (
									<option key={opt} value={opt}>
										{opt}
									</option>
								))}
							</select>
							<input
								type="number"
								className="w-20 border border-rule rounded-md px-2 py-1 text-sm bg-parchment"
								value={row.weight}
								onChange={(e) =>
									setForm((s) => ({
										...s,
										channel_mix: s.channel_mix.map((cm, i) =>
											i === index ? { ...cm, weight: Number(e.target.value) || 0 } : cm,
										),
									}))
								}
							/>
							<input
								className="flex-1 border border-rule rounded-md px-2 py-1 text-sm bg-parchment"
								placeholder="Megjegyzés"
								value={row.note ?? ""}
								onChange={(e) =>
									setForm((s) => ({
										...s,
										channel_mix: s.channel_mix.map((cm, i) =>
											i === index ? { ...cm, note: e.target.value } : cm,
										),
									}))
								}
							/>
							<button
								type="button"
								onClick={() => setForm((s) => ({ ...s, channel_mix: s.channel_mix.filter((_, i) => i !== index) }))}
								className="text-xs px-2 py-1 border border-rule rounded"
							>
								×
							</button>
						</div>
					))}
				</div>
				<div className="mt-2 flex items-center justify-between">
					<button
						type="button"
						onClick={() =>
							setForm((s) => ({ ...s, channel_mix: [...s.channel_mix, { channel: "linkedin", weight: 0, note: "" }] }))
						}
						className="text-xs px-3 py-1.5 rounded border border-rule text-ink-2 hover:bg-parchment"
					>
						Channel hozzáadása
					</button>
					<span className={`text-xs ${weightTotal === 100 ? "text-ink-2" : "text-amber-700"}`}>Súly összesen: {weightTotal}%</span>
				</div>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
				<div>
					<label className="text-xs font-medium text-ink-2 uppercase tracking-wide">Timeline kezdete</label>
					<input
						type="date"
						className="mt-1 w-full border border-rule rounded-md px-3 py-2 text-sm bg-parchment"
						value={dateInputValue(form.timeline_start)}
						onChange={(e) =>
							setForm((s) => ({
								...s,
								timeline_start: e.target.value ? new Date(`${e.target.value}T00:00:00`).getTime() : null,
							}))
						}
					/>
				</div>
				<div>
					<label className="text-xs font-medium text-ink-2 uppercase tracking-wide">Timeline vége</label>
					<input
						type="date"
						className="mt-1 w-full border border-rule rounded-md px-3 py-2 text-sm bg-parchment"
						value={dateInputValue(form.timeline_end)}
						onChange={(e) =>
							setForm((s) => ({
								...s,
								timeline_end: e.target.value ? new Date(`${e.target.value}T00:00:00`).getTime() : null,
							}))
						}
					/>
				</div>
			</div>
			<div>
				<label className="text-xs font-medium text-ink-2 uppercase tracking-wide">KPI</label>
				<textarea
					className="mt-1 w-full border border-rule rounded-md px-3 py-2 text-sm bg-parchment"
					value={form.kpi}
					onChange={(e) => setForm((s) => ({ ...s, kpi: e.target.value }))}
				/>
			</div>
			<div className="flex gap-2">
				<button
					type="submit"
					disabled={busy || !isDirty}
					className="bg-primary text-sidebar-bg font-bold px-4 py-2 rounded-md disabled:opacity-50 hover:bg-primary-hover"
				>
					Mentés
				</button>
				<button
					type="button"
					disabled={busy || !isDirty}
					onClick={() => setForm(toForm(initial))}
					className="text-xs px-3 py-1.5 rounded border border-rule text-ink-2 hover:bg-parchment disabled:opacity-50"
				>
					Elvetés
				</button>
			</div>
		</form>
	);
}
