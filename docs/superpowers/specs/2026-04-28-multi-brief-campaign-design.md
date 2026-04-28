# Marquee — Multi-Brief per Campaign Design

**Dátum:** 2026-04-28
**Státusz:** jóváhagyva (brainstorm)
**Kapcsolódó:** `2026-04-28-campaigns-design.md`

---

## Goal

Egy kampányhoz több önálló brief is tartozhasson. Jelenleg minden brief automatikusan új kampányt hoz létre (1:1 reláció). A módosítás után a human és a Director agent egyaránt tud meglévő kampányhoz csatolni új brief-et.

## Architecture

A `briefs.campaignId` FK már nullable és technikailag lehetővé teszi a több-brief-per-kampány relációt — sémaváltozás nem szükséges. A változtatás csak a két brief-létrehozási útvonalra (tool + route) és a két érintett UI komponensre korlátozódik.

**Döntési logika mindkét útvonalon:** ha `campaignId` meg van adva → meglévő kampányt használ; ha nincs → új kampányt hoz létre a title-ből (jelenlegi viselkedés, backward compatible).

---

## 1. Backend

### `packages/server/src/tools/proposals.ts` — `propose_brief` tool

Az input sémába kerül egy opcionális `campaignId: z.string().optional()` mező.

`execute` logika:
```typescript
let campaignId: string;
if (input.campaignId) {
  // validate campaign exists
  const existing = ctx.db.select().from(campaigns).where(eq(campaigns.id, input.campaignId)).get();
  if (!existing) throw new Error(`Campaign ${input.campaignId} not found`);
  campaignId = input.campaignId;
} else {
  // current behavior: create new campaign from title
  campaignId = randomUUID();
  ctx.db.insert(campaigns).values({ id: campaignId, title: input.title, status: "active" }).run();
}
```

Ha a human a chatben mondja ("add to the Q2 Launch campaign"), a Director be tudja állítani a `campaignId`-t. Ha nem mondja, az agent default-ból új kampányt hoz létre.

### `packages/server/src/server/routes/briefs.ts` — `POST /api/briefs`

Request body-ban opcionális `campaignId?: string`:

```typescript
app.post<{ Body: { contentMd: string; campaignId?: string } }>("/api/briefs", async (req, reply) => {
  const { contentMd, campaignId: existingCampaignId } = req.body;
  // ...
  let campaignId: string;
  if (existingCampaignId) {
    const existing = opts.db.select().from(campaigns).where(eq(campaigns.id, existingCampaignId)).get();
    if (!existing) return reply.status(400).send({ error: "Campaign not found" });
    campaignId = existingCampaignId;
  } else {
    // current behavior: create from title
    campaignId = randomUUID();
    opts.db.insert(campaigns).values({ id: campaignId, title: campaignTitle, status: "active" }).run();
  }
  // brief insert unchanged
});
```

### `packages/server/src/server/routes/campaigns.ts` — `GET /api/campaigns/:id`

A response-ba bekerül a `briefs` tömb (a meglévő `deliverables` + `tasks` mintájára):

```typescript
const campaignBriefs = opts.db.select().from(briefs)
  .where(eq(briefs.campaignId, req.params.id)).all();
return { ...c, briefs: campaignBriefs, deliverables: campaignDeliverables, tasks: campaignTasks };
```

---

## 2. Frontend

### `packages/web/src/lib/api.ts`

`api.briefs.create` kap egy opcionális második paramétert:
```typescript
create: (contentMd: string, campaignId?: string) =>
  post<{ id: string; ok: boolean }>("/api/briefs", { contentMd, campaignId }),
```

`api.campaigns.get` return type kiegészül `briefs` tömbbel.

### `packages/web/src/views/home.tsx` — brief submit modal

A textarea fölé/alá kerül egy "Campaign" dropdown, amely a modal megnyitásakor betölti az aktív kampányokat:

```typescript
const [campaigns, setCampaigns] = useState<Campaign[]>([]);
const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");

useEffect(() => {
  api.campaigns.list().then(setCampaigns).catch(() => {});
}, []);
```

A dropdown: `"— New campaign —"` (üres string, default) + aktív kampányok. Ha kampányok még nincsenek betöltve vagy üres a lista, a dropdown nem jelenik meg (progressive enhancement).

A submit:
```typescript
await api.briefs.create(text.trim(), selectedCampaignId || undefined);
```

### `packages/web/src/views/campaigns.tsx` — `CampaignDetailPanel`

Új "Briefs (N)" szekció a meglévő Deliverables szekció előtt:

```typescript
<div style={{ marginBottom: 20 }}>
  <div className="caption" style={{ marginBottom: 8 }}>Briefs ({campaign.briefs.length})</div>
  {campaign.briefs.length === 0
    ? <div style={{ fontSize: 13, color: "var(--ink-3)" }}>None yet</div>
    : campaign.briefs.map((b) => (
      <div key={b.id} style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 4 }}>
        {b.status === "draft" ? "Draft" : b.status === "dispatched" ? "In progress" : "Done"}
        {" — "}{b.contentMd.split("\n")[0].replace(/^#+\s*/, "").slice(0, 60)}
      </div>
    ))
  }
</div>
```

A `CampaignDetail` interfész kiegészül:
```typescript
interface CampaignDetail extends Campaign {
  briefs: { id: string; status: string; contentMd: string; createdAt: string }[];
  deliverables: ...;
  tasks: ...;
}
```

---

## 3. Testing

- `proposals.test.ts`: `campaignId` megadásakor meglévő kampányt használ; nem létező `campaignId`-re hibát dob
- `briefs.test.ts`: `campaignId` a request body-ban → meglévő kampányt használ; nem létező kampányra 400
- `campaigns.test.ts`: `GET /api/campaigns/:id` response tartalmaz `briefs` tömböt

---

## 4. Nem változik

- Séma (briefs.campaignId FK már létezik, nullable)
- Propagációs lánc (delegations, deliverables, tasks kampány-öröklése)
- Cron rutinok
- Pipeline és Tasks nézetek
