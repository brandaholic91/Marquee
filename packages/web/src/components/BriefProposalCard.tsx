import { useState, useEffect } from "react";
import { useMarqueeStore } from "../store/useMarqueeStore.js";
import { briefsApi, campaignsApi, type CampaignRow } from "../lib/api.js";
import { MarkdownView } from "./MarkdownView.js";
import { MarkdownEditor } from "./MarkdownEditor.js";
import { roleLabel } from "../lib/roles.js";

export function BriefProposalCard({
	briefId,
	title,
	contentMd,
	deliverableType,
	targetSpecialist,
	platform,
	campaignName: initialCampaignName,
	calendarItemId,
	parentDeliverableId,
}: {
	briefId: string;
	title: string;
	contentMd: string;
	deliverableType: string;
	targetSpecialist: string;
	platform?: string | null;
	campaignName?: string | null;
	calendarItemId?: string | null;
	parentDeliverableId?: string | null;
}) {
	const [busy, setBusy] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const [editing, setEditing] = useState(false);
	const [editTitle, setEditTitle] = useState(title);
	const [editContent, setEditContent] = useState(contentMd);
	const [campaignInput, setCampaignInput] = useState(initialCampaignName ?? "");
	const [existingCampaigns, setExistingCampaigns] = useState<CampaignRow[]>([]);
	const dispatchBrief = useMarqueeStore((s) => s.dispatchBrief);
	const discardBrief = useMarqueeStore((s) => s.discardBrief);
	const updateBrief = useMarqueeStore((s) => s.updateBrief);

	useEffect(() => {
		setEditTitle(title);
		setEditContent(contentMd);
	}, [title, contentMd]);
	useEffect(() => {
		campaignsApi.list().then((rows) => setExistingCampaigns(rows.filter((c) => c.status === "active")));
	}, []);

	const handleDispatch = async () => {
		setBusy(true);
		// Ha a kampány megváltozott, frissítjük dispatch előtt
		const trimmed = campaignInput.trim();
		const original = initialCampaignName ?? "";
		if (trimmed !== original) {
			await briefsApi.update(briefId, { campaign_name: trimmed || null });
		}
		await dispatchBrief(briefId);
		setBusy(false);
	};

	return (
		<>
			{editing && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
					<div className="bg-parchment rounded-xl shadow-xl w-full max-w-xl mx-4 p-6 flex flex-col gap-4">
						<h2 className="text-lg font-semibold">Brief szerkesztése</h2>

						<div>
							<label className="text-xs font-medium text-ink-2 uppercase tracking-wide">Cím</label>
							<input
								className="mt-1 w-full border border-rule rounded-md px-3 py-2 text-sm bg-off-white focus:outline-none focus:border-primary"
								value={editTitle}
								onChange={(e) => setEditTitle(e.target.value)}
							/>
						</div>

						<div>
							<label className="text-xs font-medium text-ink-2 uppercase tracking-wide">Tartalom</label>
							<div className="mt-1">
								<MarkdownEditor value={editContent} onChange={setEditContent} minHeight="220px" />
							</div>
						</div>

						<div className="flex gap-2 justify-end">
							<button
								className="px-4 py-2 rounded-md text-sm text-ink-2 hover:bg-cream"
								onClick={() => {
									setEditing(false);
									setEditTitle(title);
									setEditContent(contentMd);
								}}
							>
								Mégse
							</button>
							<button
								className="px-4 py-2 rounded-md text-sm bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
								disabled={busy}
								onClick={async () => {
									setBusy(true);
									await updateBrief(briefId, editTitle, editContent);
									setBusy(false);
									setEditing(false);
								}}
							>
								Mentés
							</button>
						</div>
					</div>
				</div>
			)}
			<div className="border-[1.5px] border-primary rounded-lg p-6 bg-off-white my-3">
				{calendarItemId && (
					<div className="mb-2 text-[11px] text-ink-2">
						📅 Calendar item: <span className="font-mono">{calendarItemId}</span>
					</div>
				)}
				<div className="flex items-center mb-1">
					<span className="text-[10px] font-bold tracking-widest text-primary uppercase flex items-center gap-1.5">
						<span className="inline-block w-1 h-3.5 bg-primary rounded-sm" />
						Brief javaslat
					</span>
				</div>
				<h3 className="text-lg font-semibold">{title}</h3>
				<div className="text-sm text-ink-2 mt-1">
					Deliverable: <strong>{deliverableType}</strong>
					{platform && <span> · platform: {platform}</span>}
					<br />
					Specialista: <strong>{roleLabel(targetSpecialist)}</strong>
				</div>
				{parentDeliverableId && (
					<div className="mt-1 text-[11px] text-ink-3">
						Forrás:{" "}
						<a href={`/jovahagyas/${parentDeliverableId}`} className="text-primary hover:underline">
							SEO content brief →
						</a>
					</div>
				)}

				{/* Kampány hozzárendelés */}
				<div className="mt-3">
					<label className="text-xs font-medium text-ink-2 uppercase tracking-wide">Kampány</label>
					<input
						className="mt-1 w-full border border-rule rounded-md px-3 py-2 text-sm bg-parchment focus:outline-none focus:border-primary"
						placeholder="Kampány neve (opcionális)…"
						value={campaignInput}
						onChange={(e) => setCampaignInput(e.target.value)}
					/>
					{existingCampaigns.length > 0 && (
						<div className="flex flex-wrap gap-1 mt-1.5">
							{existingCampaigns.map((c) => (
								<button
									key={c.id}
									type="button"
									className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
										campaignInput === c.title
											? "bg-primary text-white border-primary"
											: "bg-cream border-rule text-ink-2 hover:bg-primary-soft hover:text-primary-hover hover:border-primary/30"
									}`}
									onClick={() => setCampaignInput(campaignInput === c.title ? "" : c.title)}
								>
									{c.title}
								</button>
							))}
						</div>
					)}
				</div>

				{contentMd && (
					<div className="mt-3">
						<button className="text-xs text-primary hover:underline" onClick={() => setExpanded((v) => !v)}>
							{expanded ? "▲ Brief elrejtése" : "▼ Brief megtekintése"}
						</button>
						{expanded && (
							<div className="mt-2 bg-cream border border-rule rounded p-4 max-h-64 overflow-y-auto">
								<MarkdownView content={contentMd} />
							</div>
						)}
					</div>
				)}

				<div className="flex gap-2 mt-4">
					<button
						className="bg-primary text-sidebar-bg font-bold px-4 py-2 rounded-md disabled:opacity-50 hover:bg-primary-hover"
						disabled={busy}
						onClick={handleDispatch}
					>
						Jóváhagy &amp; indít
					</button>
					<button
						className="bg-off-white border border-rule px-4 py-2 rounded-md text-ink-2 font-medium hover:bg-cream"
						disabled={busy}
						onClick={() => setEditing(true)}
					>
						Szerkeszt
					</button>
					<button
						className="px-3 py-2 rounded-md text-ink-3 font-medium hover:text-ink-1"
						disabled={busy}
						onClick={async () => {
							setBusy(true);
							await discardBrief(briefId);
							setBusy(false);
						}}
					>
						Eldob
					</button>
				</div>
			</div>
		</>
	);
}
