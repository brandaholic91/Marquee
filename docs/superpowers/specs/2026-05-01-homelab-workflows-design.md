# Homelab MarTech Workflow-ok — Design Spec

**Dátum:** 2026-05-01
**Státusz:** Draft
**Szerző:** Balázs + Claude

## Összefoglaló

4 egymásra építő n8n workflow, amely a Marquee AI ügynökséget, a MarTech stacket (Matomo, Mautic, RustFS) és külső API-kat (fal.ai, Meta/Google Ads) köti össze. Céljuk kettős: GrowthFrame demo/portfólió eszközök (LinkedIn, sales call, weboldal) és valós napi használatra alkalmas marketing automatizálások.

**A 4 workflow:**

1. **Social Post + AI vizuál pipeline** — building block, amit a többi is újrahasznosít
2. **Analytics → akció** — Matomo-driven proaktív tartalomgyártás
3. **Ad performance → kreatív reakció** — hirdetési teljesítmény alapú automatikus optimalizálás
4. **Kampány orkesztráció** — end-to-end: terv → tartalom → kép → Mautic email

**Építkezési sorrend:** 1 → 2 → 3 → 4

**Demo narratíva (LinkedIn):** *"Megszerezlek (onboarding) → figyelem az adataidat (analytics) → optimalizálom a hirdetéseidet (ads) → futtatom a kampányaidat (orkesztráció)."*

---

## Közös infrastruktúra

### Érintett node-ok

| Node | IP | Szerep a workflow-kban |
|---|---|---|
| `ai-agency` (VM 260) | `192.168.2.60` | Marquee backend — brief fogadás, agent orkesztráció, deliverable webhook |
| `martech-lab` (VM 230) | `192.168.2.30` | n8n (workflow engine), Matomo (analytics), Mautic (email), RustFS (S3 storage) |
| `infra-edge` (LXC 210) | `192.168.2.10` | NPM reverse proxy, DNS |

### Meglévő integrációs pontok

- **Marquee → n8n:** `deliverable_shipped` webhook (POST, JSON). Payload: `event`, `deliverable_type`, `client_slug`, `content_md`, `structured_data` (beleértve `visual_brief`).
- **n8n → Marquee:** `POST /api/briefs` (Bearer token: `MARQUEE_API_TOKEN`). Briefet küld, amit a Director megkap.
- **Marquee social-manager:** A `structured_data.visual_brief` mező már definiált és kitöltött Instagram-nál kötelezően, más platformoknál opcionálisan.

### Új infrastruktúra elemek (egyszeri setup)

| Elem | Hol | Leírás |
|---|---|---|
| RustFS bucket: `marquee-artifacts` | martech-lab | Generált vizuálok és kampány-anyagok tárolása |
| fal.ai API kulcs | n8n credentials | Képgenerálás (Flux vagy SDXL modell) |
| Resend SMTP | n8n credentials + Mautic config | Email kiküldés (opcionális, Workflow 4-hez) |
| Slack webhook URL | n8n credentials | Értesítések (opcionális, bármely workflow-hoz) |
| Meta Marketing API OAuth | n8n credentials | Hirdetési teljesítmény lekérés (Workflow 3) |

---

## Workflow 1: Social Post + AI vizuál pipeline

### Cél

Egy Marquee-ban jóváhagyott social media poszthoz automatikusan AI-generált kép készül és S3-be mentődik. Ez a building block, amit a többi workflow is újrahasznosít.

### Trigger

Marquee `deliverable_shipped` webhook, ahol `deliverable_type === "social_post"` és `structured_data.visual_brief` nem null.

### Lépések

```
Marquee (deliverable shipped)
  │
  ▼
n8n Webhook node ──► szűrés: van visual_brief?
  │                         │
  │ nincs                   │ van
  ▼                         ▼
Slack értesítés       fal.ai HTTP Request
(poszt kész,            │
 kép nélkül)            ▼
                  RustFS S3 Upload
                  (marquee-artifacts/{client}/{deliverable_id}.png)
                        │
                        ▼
                  Slack/email értesítés
                  (poszt + kép link)
```

### n8n node-ok (5-6 node)

1. **Webhook** — fogadja a Marquee payloadot
2. **IF node** — `structured_data.visual_brief` létezik-e és nem null
3. **HTTP Request** — fal.ai API hívás (`POST https://fal.ai/api/v1/...`), input: visual_brief szöveg, output: image URL
4. **HTTP Request** — fal.ai eredmény kép letöltése (binary)
5. **S3 Upload** — RustFS-be mentés: `marquee-artifacts/{client_slug}/{deliverable_id}.png`
6. **Slack / Resend** — értesítés a kész tartalomról (poszt szöveg + kép S3 URL)

### fal.ai konfigráció

- **Modell:** Flux Pro vagy SDXL (a visual_brief stílus-leírásai alapján Flux ajánlott a jobb prompt-követés miatt)
- **Képméret:** Platform-függő (Instagram: 1080×1080, LinkedIn: 1200×627) — az n8n code node a `structured_data.platform` alapján választ
- **Prompt:** A `visual_brief` szövege közvetlenül megy promptként, kiegészítve egy rövid stílus-prefixszel (pl. "Professional marketing visual, clean design, ")

### RustFS tárolási struktúra

```
marquee-artifacts/
  └── {client_slug}/
      └── {deliverable_id}/
          ├── visual.png        # fal.ai generált kép
          └── metadata.json     # platform, visual_brief, generálás dátuma
```

### Szükséges Marquee kódmódosítás

**Nincs.** A meglévő webhook payload már tartalmazza a `structured_data.visual_brief`-et.

---

## Workflow 2: Analytics → akció (Matomo-driven)

### Cél

Hetente egyszer a rendszer automatikusan elemzi a Matomo analytics adatokat, és a Marquee-nak briefeket küld az eredmények alapján. A specialist agentek tartalom-javaslatokat generálnak, amiket az operátor jóváhagy.

### Trigger

n8n Schedule node — hetente egyszer (pl. hétfő 08:00 CET).

### Lépések

```
n8n Cron (hétfő 08:00)
  │
  ▼
Matomo Reporting API
(landing pages, top content, bounce rate, conversions — előző 7 nap vs. azelőtti 7 nap)
  │
  ▼
n8n Code node — elemzés
(melyik oldal esett >15%? melyik nőtt >50%? melyik a top performer?)
  │
  ▼
n8n Switch node — trigger típus alapján elágazás
  │
  ├── Konverzió esés → Brief: "Új CTA variánsok"
  │     └── POST /api/briefs → Marquee Director → copywriter
  │
  ├── Top performer → Brief: "Social posztok a népszerű cikkről"
  │     └── POST /api/briefs → Marquee Director → social-manager
  │
  └── Paid CTR benchmark alatt → Brief: "Ad copy variánsok"
        └── POST /api/briefs → Marquee Director → paid-specialist
  │
  ▼
(Marquee belső flow: specialist dolgozik → deliverable → approval)
  │
  ▼
Deliverable shipped → Workflow 1 (fal.ai + RustFS)
  │
  ▼
Slack összefoglaló: "Heti analytics riport + N kész javaslat"
```

### Matomo API hívások

A Matomo Reporting API (`http://matomo.lab2.home.arpa`) az alábbi modulokat használja:

| API modul | Metrika | Cél |
|---|---|---|
| `Actions.getPageUrls` | pageviews, bounce_rate, avg_time_on_page | Landing page teljesítmény |
| `Actions.getEntryPageUrls` | entry_nb_visits, bounce_rate | Belépési oldalak elemzése |
| `Goals.get` | nb_conversions, conversion_rate | Konverziós trendek |
| `Referrers.getCampaigns` | nb_visits, nb_conversions | Kampány attribution |

Minden hívás `period=week&date=lastWeek` vs. `date=previousWeek` összehasonlítással.

### Elemzési szabályok (n8n Code node)

```javascript
// Pseudo-logika
const rules = [
  {
    condition: (page) => page.conversion_change < -0.15,
    action: "conversion_drop",
    specialist: "copywriter",
    briefTemplate: "Új CTA variánsok a {page} oldalhoz — konverzió {change}%-ot esett"
  },
  {
    condition: (page) => page.pageview_change > 0.50,
    action: "top_performer",
    specialist: "social-manager",
    briefTemplate: "Social posztok a népszerű {page} cikkről — forgalom {change}%-ot nőtt"
  },
  {
    condition: (campaign) => campaign.ctr < benchmark_ctr,
    action: "low_ctr",
    specialist: "paid-specialist",
    briefTemplate: "Ad copy variánsok — {campaign} CTR {ctr}% (benchmark: {benchmark}%)"
  }
];
```

### Brief payload példa (n8n → Marquee)

```json
{
  "title": "Heti analytics akció — 2026-W18",
  "body": "A Matomo heti elemzése alapján:\n\n1. A /szolgaltatasok landing page konverziója 22%-ot esett (3.1% → 2.4%). Kérek 3 új CTA variánst a headline és a gomb szövegre.\n2. A /blog/first-party-data cikk 340%-os forgalomnövekedést mutat. Készíts 3 LinkedIn posztot a cikk népszerűsítésére vizuális ötletekkel.\n\nRészletes Matomo metrikák a structured_data-ban.",
  "structured_data": {
    "source": "matomo_weekly",
    "period": "2026-W18",
    "alerts": [
      {
        "type": "conversion_drop",
        "page": "/szolgaltatasok",
        "metric": "conversion_rate",
        "previous": 0.031,
        "current": 0.024,
        "change": -0.22
      },
      {
        "type": "top_performer",
        "page": "/blog/first-party-data",
        "metric": "pageviews",
        "previous": 120,
        "current": 528,
        "change": 3.40
      }
    ]
  }
}
```

### Demo mód (teszt adat)

Amíg nincs éles Matomo forgalom, az n8n workflow-ban egy **demo switch** node áll az elején:
- **Demo ON:** A Matomo API hívás helyett egy Code node fix mock adatot ad vissza (előre megírt, realisztikus metrikák)
- **Demo OFF:** Élő Matomo API hívások

Ez lehetővé teszi, hogy a teljes flow-t demózzuk LinkedIn videóban anélkül, hogy valós forgalomra lenne szükség.

### Szükséges Marquee kódmódosítás

**Nincs.** A `POST /api/briefs` endpoint és a Director→specialist delegálás már működik.

---

## Workflow 3: Ad performance → kreatív reakció

### Cél

A futó hirdetési kampányok (Meta Ads, Google Ads) teljesítményét naponta figyeli, és alulteljesítés esetén automatikusan új ad copy variánsokat + vizuálokat generál.

### Trigger

n8n Schedule node — naponta vagy 2 naponta (pl. 09:00 CET).

### Lépések

```
n8n Cron (naponta 09:00)
  │
  ▼
Meta Marketing API / Google Ads API
(ad set szintű: CTR, CPA, ROAS, impressions — utolsó 3 nap)
  │
  ▼
n8n Code node — teljesítmény elemzés
(benchmark összehasonlítás: CTR <1%? CPA >target×1.3? ROAS <target?)
  │
  ▼
Van alulteljesítő ad set?
  │
  │ nincs → Slack: "Minden rendben, nincs beavatkozás szükséges"
  │
  │ van
  ▼
POST /api/briefs → Marquee
(eredeti ad copy + metrikák + kért variáns-szögek)
  │
  ▼
Director → paid-specialist
(3 új ad_copy variáns: USP-fókusz, fájdalompont-fókusz, social proof)
  │
  ▼
Brand Voice Guardian review
  │
  ▼
Deliverable shipped → Workflow 1 (fal.ai vizuálok + RustFS)
  │
  ▼
Slack összefoglaló:
"A 'Black Friday' ad set CTR 0.8%-ra esett.
 3 új variáns + 3 kép kész: [S3 link]"
```

### Meta Marketing API konfiguráció

- **Endpoint:** `https://graph.facebook.com/v21.0/act_{ad_account_id}/insights`
- **Szükséges permission:** `ads_read` (csak olvasás — nem módosítunk hirdetéseket automatikusan)
- **Breakdowns:** `ad set` szintű
- **Metrikák:** `ctr`, `cpc`, `cost_per_action_type`, `impressions`, `reach`
- **n8n node:** Beépített **Facebook Marketing API** node, OAuth2 hitelesítéssel

### Elemzési szabályok

| Szabály | Küszöb | Specialist | Deliverable |
|---|---|---|---|
| CTR túl alacsony | < 1.0% (3 napos átlag) | paid-specialist | 3× ad_copy variáns |
| CPA túl magas | > target CPA × 1.3 | paid-specialist | 3× ad_copy variáns + landing page javaslat |
| ROAS túl alacsony | < target ROAS × 0.7 | paid-specialist + copywriter | Ad copy + landing CTA variánsok |

### Brief payload példa

```json
{
  "title": "Ad optimalizálás — Black Friday kampány (Meta)",
  "body": "A 'Black Friday — Tracking audit' ad set CTR-je 0.8%-ra esett az elmúlt 3 napban (benchmark: 1.5%). CPA: 4200 Ft (target: 3000 Ft).\n\nEredeti copy:\n\"Tudtad, hogy a vállalkozásod adatainak 60%-a elvész cookie-k nélkül? Ingyenes tracking audit — 48 órán belül megmutatjuk, mit nem látsz.\"\n\nKérek 3 új variánst:\n1. USP-fókusz: adat-szuverenitás, kontroll\n2. Fájdalompont: mennyi pénzt veszít adat nélkül\n3. Social proof: ügyfél eredmény, konkrét szám",
  "structured_data": {
    "source": "meta_ads_performance",
    "platform": "meta",
    "ad_set_name": "Black Friday — Tracking audit",
    "metrics": {
      "ctr": 0.008,
      "cpa_huf": 4200,
      "impressions": 12400,
      "reach": 8900,
      "benchmark_ctr": 0.015,
      "target_cpa_huf": 3000
    },
    "original_copy": "Tudtad, hogy a vállalkozásod adatainak 60%-a elvész cookie-k nélkül? Ingyenes tracking audit — 48 órán belül megmutatjuk, mit nem látsz."
  }
}
```

### Demo mód

Ugyanaz a minta mint Workflow 2-nél: demo switch + mock ad performance adatok. A teljes flow demózható éles Meta account nélkül is.

### Szükséges Marquee kódmódosítás

**Nincs.** A `POST /api/briefs` és a paid-specialist agent már létezik.

---

## Workflow 4: Kampány orkesztráció — end-to-end pipeline

### Cél

Egy Marquee-ban megtervezett kampány összes deliverable-je (social posztok, email, blog) automatikusan vizuálokat kap, és amikor a kampány összes eleme kész, az email deliverable Mautic-ba kerül küldésre kész kampányként.

### Trigger

Marquee `campaign_complete` webhook — új event, amit a Marquee küld amikor egy kampány összes calendar item-je `delivered` státuszba kerül.

### Lépések

```
Marquee Plan UI
(Director + operátor megtervezi a kampányt: cél, audience, channels, calendar)
  │
  ▼
Calendar item-ek → briefek → specialist-ek dolgoznak
(minden shipped deliverable → Workflow 1: fal.ai + RustFS)
  │
  ▼
Utolsó calendar item is delivered
  │
  ▼
Marquee emittálja: campaign_complete webhook
  │
  ▼
n8n Webhook node fogadja
  │
  ▼
n8n → Marquee API: kampány összes deliverable lekérése
  │
  ▼
n8n → RustFS: összes vizuál összegyűjtése a kampány deliverable_id-khez
  │
  ▼
n8n Code node: email deliverable HTML-lé konvertálása
(content_md → HTML + hero image beágyazás az S3 URL-ről)
  │
  ▼
n8n → Mautic API:
  1. POST /api/emails — email létrehozás (HTML body + subject)
  2. POST /api/campaigns/new — kampány létrehozás email action-nel
  3. Szegmens hozzárendelés az audience mező alapján
  │
  ▼
Slack összefoglaló:
"A Black Friday kampány kész:
 - 1 email → Mautic-ban review-ra vár
 - 3 LinkedIn poszt + képek → RustFS-ben
 - 1 blog post → RustFS-ben
 Link: [Mautic kampány URL]"
```

### campaign_complete webhook — új Marquee event

Ez az egyetlen workflow, ami Marquee kódmódosítást igényel.

**Hol:** `packages/server/src/broker/calendar-state-machine.ts`

**Mit:** Amikor egy calendar item `delivered` státuszba lép, ellenőrizni kell, hogy a kampány összes calendar item-je `delivered`-e. Ha igen, emittálni:

```typescript
broker.emit({
  type: "campaign_complete",
  campaign_id: campaignId,
  calendar_items_count: totalItems,
  delivered_count: deliveredItems,
});
```

**Webhook firing:** A `fireDeliverableShipped` mintájára egy `fireCampaignComplete` függvény, ami a `N8N_WEBHOOK_URL`-re küldi a payloadot:

```json
{
  "event": "campaign_complete",
  "campaign_id": "...",
  "campaign_name": "Black Friday 2026",
  "client_slug": "growthframe",
  "calendar_items": [
    {
      "id": "...",
      "type": "email",
      "deliverable_id": "...",
      "status": "delivered"
    },
    {
      "id": "...",
      "type": "social_post",
      "deliverable_id": "...",
      "status": "delivered"
    }
  ],
  "completed_at": 1746100000000
}
```

### Mautic API hívások (n8n → Mautic)

| Lépés | Endpoint | Payload |
|---|---|---|
| Email létrehozás | `POST /api/emails/new` | `{ name, subject, customHtml, emailType: "list" }` |
| Szegmens lookup | `GET /api/segments?search={audience}` | — |
| Kampány létrehozás | `POST /api/campaigns/new` | `{ name, events: [{ type: "campaign.action", ... }] }` |

### Email HTML generálás (n8n Code node)

Az email deliverable `content_md`-jéből egyszerű HTML-t generálunk:
- Markdown → HTML konverzió (n8n-ben `marked` library)
- Hero image beágyazás: `<img src="{rustfs_public_url}/{deliverable_id}/visual.png">`
- Inline CSS (email-kompatibilis)

**Megjegyzés:** A RustFS-ben tárolt képeknek publikusan elérhetőnek kell lenniük ahhoz, hogy az email kliensek megjelenítik. Ez azt jelenti, hogy az `infra-edge` NPM-ben a `marquee-artifacts` bucket-et ki kell tenni egy publikus URL-re (pl. `https://assets.growthframe.hu/...`). Enélkül a képek csak LAN-on belül láthatók.

### Szükséges módosítások

| Hol | Mi | Komplexitás |
|---|---|---|
| Marquee: `calendar-state-machine.ts` | `campaign_complete` event emittálás | Alacsony |
| Marquee: `broker/` | `fireCampaignComplete` webhook függvény | Alacsony (copy-paste `fireDeliverableShipped` mintájára) |
| Marquee: `server/routes/` | Kampány deliverable-jei API endpoint (ha nincs) | Közepes |
| infra-edge: NPM | RustFS bucket publikus proxy | Alacsony (NPM config) |

---

## Összefoglaló: egymásra építkezés

```
Workflow 1: Social Post + AI vizuál
    ▲ (újrahasznosítja)
    │
Workflow 2: Analytics → akció
    │
Workflow 3: Ad performance → kreatív reakció
    │
    ▼ (minden deliverable-re fut)
Workflow 1: fal.ai + RustFS
    │
    ▼ (kampány completeness)
Workflow 4: Kampány orkesztráció → Mautic
```

**Workflow 1** az alap building block — a többi három mind erre épít a vizuálgenerálás+tárolás résznél.

**Workflow 2 és 3** a proaktív, analytics-driven workflowk — hasonló minta, más adatforrás (Matomo vs. Ads API).

**Workflow 4** az end-to-end pipeline, ami az összes előzőt összefogja egy kampány-szintű narratívába.

## Demo stratégia

### LinkedIn videó struktúra (60-90 sec)

1. **Hook (5 sec):** "Mi történik, ha a marketing rendszered okosabb nálad?"
2. **Workflow 1 demo (15 sec):** Beírok egy mondatot → kész poszt + AI kép
3. **Workflow 2 demo (20 sec):** A rendszer magától észrevette, hogy esett a konverzió → kész javaslatokkal jött
4. **Workflow 3 demo (15 sec):** A hirdetés alulteljesít → 3 új variáns készen áll
5. **Workflow 4 demo (20 sec):** Egy kampányterv → végigfut → Mautic-ban küldésre kész email
6. **CTA (5 sec):** "Ez a GrowthFrame. Kiszámítható marketing, rendszerként."

### Teszt/seed adat stratégia

Minden workflow rendelkezik demo switch-csel:
- Matomo mock adatok (realisztikus landing page + konverziós metrikák)
- Meta Ads mock adatok (realisztikus CTR/CPA/ROAS metrikák)
- A Marquee-ban valós agent generálás fut (ez nem kell mock, az LLM élesben dolgozik)

---

## Következő lépések

1. Workflow 1 implementálása (n8n workflow build + RustFS bucket + fal.ai credential)
2. Workflow 2 implementálása (n8n workflow + Matomo API + demo mock adatok)
3. Workflow 3 implementálása (n8n workflow + Meta Ads API credential + demo mock)
4. Marquee kódmódosítás: `campaign_complete` event (Workflow 4 előfeltétel)
5. Workflow 4 implementálása (n8n workflow + Mautic API + RustFS publikus proxy)
6. Demo videó felvétele
