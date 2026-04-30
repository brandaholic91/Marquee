import { useState } from "react";
import { proposalsApi } from "../lib/api.js";

export type CalendarProposal = {
	proposal_id: string;
	proposal: {
		channel: string;
		deliverable_type?: string;
		target_date: number;
		intent: string;
		rationale?: string;
	};
	status?: "pending" | "accepted" | "discarded";
};

export function CalendarItemProposalCard({ messageId, payload }: { messageId: string; payload: CalendarProposal }) {
	const [busy, setBusy] = useState(false);
	const status = payload.status ?? "pending";

	return (
		<div className="border-[1.5px] border-primary rounded-lg p-5 bg-off-white my-3">
			<div className="text-[10px] font-bold tracking-widest text-primary uppercase">Calendar item javaslat</div>
			<p className="text-sm mt-2 text-ink-1">
				<strong>{payload.proposal.channel}</strong>
				{payload.proposal.deliverable_type ? ` · ${payload.proposal.deliverable_type}` : ""}
			</p>
			<p className="text-sm mt-1 text-ink-1">{payload.proposal.intent}</p>
			<p className="text-xs mt-1 text-ink-2">Céldátum: {new Date(payload.proposal.target_date).toLocaleDateString("hu-HU")}</p>
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
