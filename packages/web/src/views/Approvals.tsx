import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMarqueeStore } from "../store/useMarqueeStore.js";
import { deliverablesApi, type DeliverableRow, type DeliverableDetail } from "../lib/api.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { RevisionTabs } from "../components/RevisionTabs.js";
import { BrandVoiceReviewPanel } from "../components/BrandVoiceReviewPanel.js";
import { MarkdownView } from "../components/MarkdownView.js";
import { SendBackModal } from "../components/SendBackModal.js";

interface Revision {
	id: string;
	revisionNo: number;
	artifactPath?: string;
}

export function Approvals() {
	const { id: urlId } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const fetchDeliverables = useMarqueeStore((s) => s.fetchDeliverables);
	const approveDeliverable = useMarqueeStore((s) => s.approveDeliverable);
	const discardDeliverable = useMarqueeStore((s) => s.discardDeliverable);
	const returnDeliverable = useMarqueeStore((s) => s.returnDeliverable);

	const [selectedId, setSelectedId] = useState<string | null>(urlId ?? null);
	const [detail, setDetail] = useState<DeliverableDetail | null>(null);
	const [allDeliverables, setAllDeliverables] = useState<DeliverableRow[]>([]);
	const [showSendBack, setShowSendBack] = useState(false);
	const [showHandoff, setShowHandoff] = useState(false);

	// Revision tab state
	const [selectedRev, setSelectedRev] = useState<string | null>(null);
	const [content, setContent] = useState<string | null>(null);
	const [loadingContent, setLoadingContent] = useState(false);

	function loadList() {
		fetchDeliverables("awaiting_approval");
		deliverablesApi.list().then((rows) => {
			const sorted = [...rows].sort((a, b) => b.updatedAt - a.updatedAt);
			setAllDeliverables(sorted);
		});
	}

	useEffect(() => {
		loadList();
	}, [fetchDeliverables]);

	useEffect(() => {
		if (urlId) setSelectedId(urlId);
	}, [urlId]);

	useEffect(() => {
		if (!selectedId) return;
		setDetail(null);
		setSelectedRev(null);
		setContent(null);
		deliverablesApi
			.get(selectedId)
			.then((raw) => {
				setDetail(raw);
				const revisions = (raw.revisions as Revision[]) ?? [];
				const currentRevId = raw.deliverable.currentRevisionId ?? revisions[revisions.length - 1]?.id ?? null;
				setSelectedRev(currentRevId);
			})
			.catch(() => setDetail(null));
	}, [selectedId]);

	useEffect(() => {
		if (!selectedId || !selectedRev) return;
		setLoadingContent(true);
		fetch(`/api/deliverables/${selectedId}/revisions/${selectedRev}/content`)
			.then((r) => r.json())
			.then((res: { content?: string; error?: string }) => {
				setContent(res.content ?? null);
				setLoadingContent(false);
			})
			.catch(() => {
				setContent(null);
				setLoadingContent(false);
			});
	}, [selectedId, selectedRev]);

	function selectItem(id: string) {
		setSelectedId(id);
		navigate(`/jovahagyas/${id}`, { replace: true });
	}

	const pending = allDeliverables.filter((d) => d.status === "awaiting_approval");
	const shipped = allDeliverables.filter((d) => d.status === "shipped");
	const pendingCount = pending.length;
	const shippedToday = shipped.filter((d) => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		return d.updatedAt >= today.getTime();
	});

	const canAct = detail?.deliverable.status === "awaiting_approval";
	const revisions = (detail?.revisions as Revision[]) ?? [];
	const currentRev = revisions.find((r) => r.id === selectedRev) ?? revisions[revisions.length - 1];

	return (
		<div className="flex flex-1 h-screen overflow-hidden">
			{/* Lista panel */}
			<div
				className={`${selectedId ? "hidden md:flex" : "flex"} w-full md:w-[260px] md:shrink-0 border-r border-rule flex-col bg-cream`}
			>
				<div className="px-4 py-4 border-b border-rule">
					<h1 className="text-[16px] font-extrabold text-ink-1 tracking-tight">Jóváhagyások</h1>
					<p className="text-[12px] text-ink-3 mt-0.5">
						{pendingCount} vár · {shippedToday.length} ma kiszállítva
					</p>
				</div>

				<div className="flex-1 overflow-auto">
					{pending.map((d) => (
						<DeliverableListItem key={d.id} d={d} isActive={d.id === selectedId} onClick={() => selectItem(d.id)} />
					))}

					{pending.length === 0 && (
						<p className="text-[12px] text-ink-3 px-4 py-6 text-center">Nincs várakozó jóváhagyás.</p>
					)}

					{shippedToday.length > 0 && (
						<>
							<div className="px-4 py-2 bg-parchment border-y border-rule">
								<span className="text-[10px] font-semibold text-ink-3 tracking-[0.08em] uppercase">Ma kiszállítva</span>
							</div>
							{shippedToday.map((d) => (
								<DeliverableListItem
									key={d.id}
									d={d}
									isActive={d.id === selectedId}
									onClick={() => selectItem(d.id)}
									dim
								/>
							))}
						</>
					)}
				</div>
			</div>

			{/* Detail panel */}
			<div className={`${selectedId ? "flex" : "hidden md:flex"} flex-1 flex-col min-w-0 overflow-hidden`}>
				{detail ? (
					<>
						{/* Header */}
						<div className="px-5 py-4 border-b border-rule flex items-start justify-between gap-3 bg-cream shrink-0">
							<div className="flex items-start gap-2 min-w-0">
								<button
									onClick={() => {
										setSelectedId(null);
										navigate("/jovahagyas", { replace: true });
									}}
									className="md:hidden shrink-0 text-ink-2 text-[13px] font-medium mt-0.5"
								>
									← Vissza
								</button>
								<div>
									<p className="text-[15px] font-bold text-ink-1">
										{detail.deliverable.title ?? detail.deliverable.type}
									</p>
									<p className="text-[11px] text-ink-3 font-mono">{detail.deliverable.type}</p>
									<div className="flex items-center gap-2 mt-1">
										<StatusBadge status={detail.deliverable.status} />
										<span className="text-[11px] text-ink-3 font-mono">
											{new Date(detail.deliverable.updatedAt).toLocaleTimeString("hu-HU", {
												hour: "2-digit",
												minute: "2-digit",
											})}
										</span>
									</div>
								</div>
							</div>
							{canAct && (
								<div className="flex gap-2 shrink-0">
									<button
										onClick={() => setShowSendBack(true)}
										className="bg-off-white border border-rule text-ink-2 font-medium text-[12px] px-3 py-1.5 rounded-btn hover:bg-parchment"
									>
										Visszaküld
									</button>
									<button
										onClick={() => void discardDeliverable(detail.deliverable.id).then(() => loadList())}
										className="bg-off-white border border-rule text-ink-3 font-medium text-[12px] px-3 py-1.5 rounded-btn hover:bg-parchment"
									>
										Eldob
									</button>
									<button
										onClick={() => void approveDeliverable(detail.deliverable.id).then(() => loadList())}
										className="bg-primary text-sidebar-bg font-bold text-[12px] px-3 py-1.5 rounded-btn hover:bg-primary-hover"
									>
										✓ Jóváhagy
									</button>
								</div>
							)}
							{canAct && detail.deliverable.type === "content_brief_seo" && (
								<button
									onClick={() => setShowHandoff(true)}
									className="bg-off-white border border-rule text-ink-2 font-medium text-[12px] px-3 py-1.5 rounded-btn hover:bg-parchment"
								>
									Átadás Copywriter-nek →
								</button>
							)}
						</div>

						{/* Scrollable body */}
						<div className="flex-1 overflow-auto p-5 pb-14 md:pb-5">
							<RevisionTabs
								revisions={revisions}
								currentId={detail.deliverable.currentRevisionId ?? undefined}
								selectedId={selectedRev}
								onSelect={setSelectedRev}
							/>

							{revisions.length > 0 && (
								<div className="border border-rule bg-off-white rounded-lg p-6 mt-3">
									{currentRev ? (
										<div>
											<div className="text-ink-2 text-sm mb-3 italic">Verzió {currentRev.revisionNo}</div>
											{loadingContent ? (
												<div className="text-ink-2 italic">Betöltés…</div>
											) : content ? (
												<MarkdownView content={content} />
											) : (
												<div className="text-ink-2 italic">Nincs tartalom elérhető.</div>
											)}
										</div>
									) : (
										<div className="text-ink-2 italic">Még nincs revízió.</div>
									)}
								</div>
							)}

							<BrandVoiceReviewPanel deliverableId={detail.deliverable.id} />
						</div>

						{showSendBack && (
							<SendBackModal
								deliverableId={detail.deliverable.id}
								onCancel={() => setShowSendBack(false)}
								onSubmit={async (note) => {
									await returnDeliverable(detail.deliverable.id, note);
									setShowSendBack(false);
									loadList();
								}}
							/>
						)}

						{showHandoff && detail && (
							<HandoffModal
								deliverable={detail.deliverable}
								onCancel={() => setShowHandoff(false)}
								onSubmit={async (overrides) => {
									const { brief_id } = await deliverablesApi.handoff(detail.deliverable.id, {
										target_role: "copywriter",
										brief_overrides: overrides,
									});
									setShowHandoff(false);
									navigate("/");
								}}
							/>
						)}
					</>
				) : (
					<div className="flex-1 flex items-center justify-center">
						<p className="text-[13px] text-ink-3">Válassz ki egy elemet a listából.</p>
					</div>
				)}
			</div>
		</div>
	);
}

function DeliverableListItem({
	d,
	isActive,
	onClick,
	dim,
}: {
	d: DeliverableRow;
	isActive: boolean;
	onClick: () => void;
	dim?: boolean;
}) {
	return (
		<button
			onClick={onClick}
			className={`w-full text-left px-4 py-3 border-b border-rule transition-colors ${
				isActive
					? "bg-off-white border-l-[3px] border-l-primary"
					: "border-l-[3px] border-l-transparent hover:bg-parchment"
			} ${dim ? "opacity-70" : ""}`}
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<span
						className={`text-[13px] leading-snug block truncate ${
							isActive ? "font-semibold text-ink-1" : "font-medium text-ink-1"
						}`}
					>
						{d.title ?? d.type}
					</span>
					{d.title && <span className="text-[10px] text-ink-3">{d.type}</span>}
				</div>
				<StatusBadge status={d.status} />
			</div>
			<p className="text-[11px] text-ink-3 mt-1">
				{new Date(d.updatedAt).toLocaleTimeString("hu-HU", {
					hour: "2-digit",
					minute: "2-digit",
				})}
			</p>
		</button>
	);
}

function HandoffModal({
	deliverable,
	onCancel,
	onSubmit,
}: {
	deliverable: DeliverableRow;
	onCancel: () => void;
	onSubmit: (overrides: { title?: string; campaign_name?: string }) => Promise<void>;
}) {
	const [title, setTitle] = useState("");
	const [campaign, setCampaign] = useState("");
	const [busy, setBusy] = useState(false);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
			<div className="bg-parchment rounded-xl shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4">
				<h2 className="text-[15px] font-semibold">Átadás Copywriter-nek</h2>
				<p className="text-[12px] text-ink-3">
					Egy Copywriter brief javaslat jön létre a SEO brief alapján. Az operátor jóváhagyja mielőtt a Copywriter
					megkapja.
				</p>
				<div>
					<label className="text-[11px] font-medium text-ink-2 uppercase tracking-wide">Cím</label>
					<input
						className="mt-1 w-full border border-rule rounded-md px-3 py-2 text-sm bg-off-white focus:outline-none focus:border-primary"
						placeholder="pl. saas onboarding — SEO cikk"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
					/>
				</div>
				<div>
					<label className="text-[11px] font-medium text-ink-2 uppercase tracking-wide">Kampány (opcionális)</label>
					<input
						className="mt-1 w-full border border-rule rounded-md px-3 py-2 text-sm bg-off-white focus:outline-none focus:border-primary"
						placeholder="Kampány neve…"
						value={campaign}
						onChange={(e) => setCampaign(e.target.value)}
					/>
				</div>
				<div className="flex gap-2 justify-end">
					<button className="px-4 py-2 rounded-md text-sm text-ink-2 hover:bg-cream" onClick={onCancel}>
						Mégse
					</button>
					<button
						className="px-4 py-2 rounded-md text-sm bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
						disabled={busy}
						onClick={async () => {
							setBusy(true);
							await onSubmit({
								title: title.trim() || undefined,
								campaign_name: campaign.trim() || undefined,
							});
							setBusy(false);
						}}
					>
						Átadás
					</button>
				</div>
			</div>
		</div>
	);
}
