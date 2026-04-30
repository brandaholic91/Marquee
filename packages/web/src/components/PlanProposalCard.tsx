import { useState } from "react";
import { proposalsApi } from "../lib/api.js";

export type PlanProposal = {
	proposal_id: string;
	proposal: {
		goal?: string;
		audience?: string;
		kpi?: string;
		calendar_items?: Array<unknown>;
		patch?: Record<string, unknown>;
		rationale?: string;
	};
	status?: "pending" | "accepted" | "discarded";
};

export function PlanProposalCard({ messageId, payload }: { messageId: string; payload: PlanProposal }) {
	const [busy, setBusy] = useState(false);
	const status = payload.status ?? "pending";
	const isUpdate = Boolean(payload.proposal.patch);

	return (
		<div className="border-[1.5px] border-primary rounded-lg p-5 bg-off-white my-3">
			<div className="text-[10px] font-bold tracking-widest text-primary uppercase">Kampányterv javaslat</div>
			<h3 className="mt-1 text-base font-semibold text-ink-1">{isUpdate ? "Tervmódosítás" : "Új kampányterv"}</h3>
			{payload.proposal.goal && <p className="text-sm mt-2 text-ink-1"><strong>Cél:</strong> {payload.proposal.goal}</p>}
			{payload.proposal.audience && <p className="text-sm mt-1 text-ink-1"><strong>Audience:</strong> {payload.proposal.audience}</p>}
			{payload.proposal.kpi && <p className="text-sm mt-1 text-ink-1"><strong>KPI:</strong> {payload.proposal.kpi}</p>}
			{Array.isArray(payload.proposal.calendar_items) && (
				<p className="text-xs mt-2 text-ink-2">Calendar itemek: {payload.proposal.calendar_items.length} db</p>
			)}
			{payload.proposal.rationale && <p className="text-xs mt-2 text-ink-2">Indoklás: {payload.proposal.rationale}</p>}

			{status === "pending" ? (
				<div className="flex gap-2 mt-4">
					<button
						className="bg-primary text-sidebar-bg font-bold px-4 py-2 rounded-md disabled:opacity-50 hover:bg-primary-hover"
						disabled={busy}
						onClick={async () => {
							setBusy(true);
							await proposalsApi.accept(messageId);
							setBusy(false);
						}}
					>
						Jóváhagy
					</button>
					<button
						className="px-3 py-2 rounded-md text-ink-3 font-medium hover:text-ink-1 disabled:opacity-50"
						disabled={busy}
						onClick={async () => {
							setBusy(true);
							await proposalsApi.discard(messageId);
							setBusy(false);
						}}
					>
						Eldob
					</button>
				</div>
			) : (
				<p className="text-xs mt-4 text-ink-2">Státusz: {status === "accepted" ? "elfogadva" : "elutasítva"}</p>
			)}
		</div>
	);
}
