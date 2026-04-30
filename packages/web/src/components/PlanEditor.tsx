import { useState } from "react";
import type { CampaignPlan } from "../lib/api.js";

type PlanForm = {
	goal: string;
	goal_type: CampaignPlan["goalType"];
	audience: string;
	kpi: string;
};

export function PlanEditor({
	initial,
	busy,
	onSave,
}: {
	initial: CampaignPlan | null;
	busy?: boolean;
	onSave: (form: PlanForm) => Promise<void>;
}) {
	const [form, setForm] = useState<PlanForm>({
		goal: initial?.goal ?? "",
		goal_type: initial?.goalType ?? "other",
		audience: initial?.audience ?? "",
		kpi: initial?.kpi ?? "",
	});

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
				<input
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
				<label className="text-xs font-medium text-ink-2 uppercase tracking-wide">KPI</label>
				<input
					className="mt-1 w-full border border-rule rounded-md px-3 py-2 text-sm bg-parchment"
					value={form.kpi}
					onChange={(e) => setForm((s) => ({ ...s, kpi: e.target.value }))}
				/>
			</div>
			<button
				type="submit"
				disabled={busy}
				className="bg-primary text-sidebar-bg font-bold px-4 py-2 rounded-md disabled:opacity-50 hover:bg-primary-hover"
			>
				Mentés
			</button>
		</form>
	);
}
