# Közvetlen kampánylétrehozás Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kampányt lehessen közvetlenül létrehozni a Campaigns oldalról, és automatikusan egy új Workshop chat threadbe navigáljon a kampány tervezéséhez.

**Architecture:** Backend: új `POST /api/campaigns` endpoint `campaigns.ts`-ben. Frontend: `campaignsApi.create()` az `api.ts`-ben, `initialText` prop a `ChatComposer`-ben, navigation state olvasás a `Workshop`-ban, gomb + modal a `Campaigns.tsx`-ben.

**Tech Stack:** Fastify 5, Drizzle ORM, better-sqlite3, React 19, TypeScript strict, Vitest, Zustand, React Router 6

---

## File Map

| Fájl | Változás |
|---|---|
| `packages/server/src/server/routes/campaigns.ts` | `POST /api/campaigns` endpoint hozzáadása |
| `packages/server/src/server/routes/campaigns.test.ts` | 2 új teszt: 201 és 409 |
| `packages/web/src/lib/api.ts` | `campaignsApi.create()` metódus |
| `packages/web/src/components/ChatComposer.tsx` | `initialText` prop |
| `packages/web/src/views/Workshop.tsx` | `useLocation` + `prefilledMessage` → `ChatComposer` |
| `packages/web/src/views/Campaigns.tsx` | `+ Új kampány` gomb + modal + `handleCreate` |

---

## Task 1: Backend — `POST /api/campaigns`

**Files:**
- Modify: `packages/server/src/server/routes/campaigns.ts`
- Modify: `packages/server/src/server/routes/campaigns.test.ts`

- [ ] **Step 1: Írj két failing tesztet**

A `packages/server/src/server/routes/campaigns.test.ts` fájlban a `describe` blokk végéhez (a záró `});` elé) add hozzá:

```typescript
  it("POST /api/campaigns creates a campaign", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/campaigns",
      payload: { title: "Új kampány" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeTruthy();
    expect(body.title).toBe("Új kampány");
    expect(body.status).toBe("active");

    const list = await app.inject({ method: "GET", url: "/api/campaigns" });
    const campaigns = list.json() as Array<{ title: string }>;
    expect(campaigns.some((c) => c.title === "Új kampány")).toBe(true);
  });

  it("POST /api/campaigns returns 409 for duplicate title", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/campaigns",
      payload: { title: "Campaign" }, // already seeded in beforeEach as "Campaign"
    });
    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error).toBe("campaign_exists");
  });
```

- [ ] **Step 2: Futtasd — bukjanak el**

```bash
ssh ai-agency "cd /opt/marquee/packages/server && npx vitest run src/server/routes/campaigns.test.ts --reporter=verbose 2>&1 | tail -20"
```

Várt: az új 2 teszt FAIL (404 — endpoint még nem létezik).

- [ ] **Step 3: Implementáld a POST endpointot**

A `packages/server/src/server/routes/campaigns.ts` fájlban:

**1. Importálj `createId`-t** — az első sor után (az imports blokkba):
```typescript
import { createId } from '@paralleldrive/cuid2';
```

**2. A `campaignsRoutes` async funkció záró `};` elé** (a `PATCH` handler után) add hozzá:

```typescript
  app.post<{ Body: { title?: string } }>(
    '/api/campaigns',
    async (req, reply) => {
      const title = req.body?.title?.trim();
      if (!title) return reply.code(400).send({ error: 'title_required' });

      const id = createId();
      try {
        await db.insert(campaigns).values({
          id,
          clientSlug: 'default',
          title,
          status: 'active',
          createdAt: Date.now(),
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
          return reply.code(409).send({ error: 'campaign_exists' });
        }
        throw err;
      }

      return reply.code(201).send({ id, title, status: 'active', createdAt: Date.now() });
    },
  );
```

- [ ] **Step 4: Futtasd — mind zöld legyen**

```bash
ssh ai-agency "cd /opt/marquee/packages/server && npx vitest run src/server/routes/campaigns.test.ts --reporter=verbose 2>&1 | tail -20"
```

Várt: 3 teszt, mind PASS.

- [ ] **Step 5: TS check**

```bash
ssh ai-agency "cd /opt/marquee && npx tsc --noEmit -p packages/server/tsconfig.json 2>&1"
```

Várt: nincs hiba.

- [ ] **Step 6: Commit**

```bash
ssh ai-agency "cd /opt/marquee && git add packages/server/src/server/routes/campaigns.ts packages/server/src/server/routes/campaigns.test.ts && git commit -m 'feat(campaign): POST /api/campaigns endpoint'"
```

---

## Task 2: Frontend plumbing — `api.ts`, `ChatComposer.tsx`, `Workshop.tsx`

Ezt az egész task-t egy commitban csináld.

**Files:**
- Modify: `packages/web/src/lib/api.ts`
- Modify: `packages/web/src/components/ChatComposer.tsx`
- Modify: `packages/web/src/views/Workshop.tsx`

- [ ] **Step 1: `api.ts` — `campaignsApi.create()` hozzáadása**

A `packages/web/src/lib/api.ts`-ben a `campaignsApi` objektumban (jelenleg `list`, `get`, `patch` metódusok vannak) add hozzá a `create` metódust a `list:` sor elé:

```typescript
export const campaignsApi = {
	create: (title: string): Promise<{ id: string; title: string; status: string; createdAt: number }> =>
		fetch('/api/campaigns', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ title }),
		}).then(async (r) => {
			const body = await r.json();
			if (!r.ok) throw body;
			return body as { id: string; title: string; status: string; createdAt: number };
		}),
	list: (): Promise<CampaignRow[]> => fetch("/api/campaigns").then(json),
	// ... többi metódus változatlan
```

**Megjegyzés:** Az `api.ts`-ben lévő `post()` helper nem ellenőrzi `r.ok`-t, ezért `fetch`-et használunk közvetlenül, hogy 409-nél dobjunk (ne silent parse-oljuk).

- [ ] **Step 2: `ChatComposer.tsx` — `initialText` prop**

A `packages/web/src/components/ChatComposer.tsx`-ben cseréld le a függvény fejlécét és az első `useState`-et:

Erről:
```typescript
export function ChatComposer({ placeholder = 'Írj a Directornak…' }: { placeholder?: string }) {
  const [text, setText] = useState('');
```

Erre:
```typescript
export function ChatComposer({ placeholder = 'Írj a Directornak…', initialText }: { placeholder?: string; initialText?: string }) {
  const [text, setText] = useState(initialText ?? '');
```

Minden más marad változatlan.

- [ ] **Step 3: `Workshop.tsx` — navigation state olvasás**

A `packages/web/src/views/Workshop.tsx`-ben:

**1. Import hozzáadása** — az első import sor után:
```typescript
import { useLocation } from 'react-router-dom';
```

**2. A `Workshop()` komponens elejéhez** (a meglévő `const memoryEmpty = ...` sor elé) add:
```typescript
  const location = useLocation();
  const prefilledMessage = (location.state as { prefilledMessage?: string } | null)?.prefilledMessage ?? undefined;
```

**3. A `ChatComposer` JSX-ben** (jelenleg sor 97: `<ChatComposer placeholder={...} />`) add hozzá az `initialText` prop-ot:
```tsx
<ChatComposer
  placeholder={isCampaignThread ? 'Director tervezi a kampányt…' : 'Írj a Directornak…'}
  initialText={prefilledMessage}
/>
```

- [ ] **Step 4: TS check**

```bash
ssh ai-agency "cd /opt/marquee && npx tsc --noEmit -p packages/web/tsconfig.json 2>&1 | head -20"
```

Várt: nincs hiba.

- [ ] **Step 5: Commit**

```bash
ssh ai-agency "cd /opt/marquee && git add packages/web/src/lib/api.ts packages/web/src/components/ChatComposer.tsx packages/web/src/views/Workshop.tsx && git commit -m 'feat(campaign): create campaign API + ChatComposer initialText + Workshop prefill'"
```

---

## Task 3: `Campaigns.tsx` — gomb + modal + navigáció

**Files:**
- Modify: `packages/web/src/views/Campaigns.tsx`

- [ ] **Step 1: Importok és új state-ek hozzáadása**

A `packages/web/src/views/Campaigns.tsx` fájl tetején:

**1. Importhoz add** `useMarqueeStore` és `campaignsApi`:

A meglévő import sor:
```typescript
import {
  campaignsApi,
  plansApi,
```
Már ott van a `campaignsApi` — csak ellenőrizd.

A `useMarqueeStore` importot add hozzá az `import { marqueeEvents }` sor után:
```typescript
import { useMarqueeStore } from "../store/useMarqueeStore.js";
```

**2. A `Campaigns()` komponens belsejébe** (a meglévő `const [addingItem, setAddingItem]` sor után) add:
```typescript
  const createThread = useMarqueeStore((s) => s.createThread);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
```

- [ ] **Step 2: `handleCreate` függvény**

A `toggleExpand` függvény elé add be:

```typescript
  async function handleCreate() {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    setCreateError(null);
    try {
      await campaignsApi.create(title);
      await createThread();
      setShowModal(false);
      navigate('/', { state: { prefilledMessage: `Tervezzük meg a ${title} kampányt` } });
    } catch (err: unknown) {
      const body = err as { error?: string };
      if (body?.error === 'campaign_exists') {
        setCreateError('Ez a kampánynév már foglalt.');
      } else {
        setCreateError('Hiba történt. Próbáld újra.');
      }
      setCreating(false);
    }
  }
```

- [ ] **Step 3: Header gomb hozzáadása**

Keresd meg (sor ~135):
```tsx
      <h1 className="text-xl font-bold text-ink-1 mb-4">Kampányok</h1>
```

Cseréld erre:
```tsx
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-ink-1">Kampányok</h1>
        <button
          className="text-xs px-3 py-1.5 rounded border border-rule text-ink-2 hover:bg-parchment"
          onClick={() => { setNewTitle(''); setCreateError(null); setShowModal(true); }}
        >
          + Új kampány
        </button>
      </div>
```

- [ ] **Step 4: Modal JSX hozzáadása**

A `Campaigns.tsx` return blokkjában, a záró `</div>` elé (az utolsó `</div>` a `return` blokkban, ahol a `CalendarItemEditModal` is van), add a modalt:

```tsx
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="bg-cream border border-rule rounded-lg p-6 w-full max-w-sm shadow-lg">
            <h2 className="text-sm font-semibold text-ink-1 mb-4">Új kampány</h2>
            <label className="block text-xs text-ink-2 mb-1">Kampány neve</label>
            <input
              autoFocus
              className="w-full border border-rule rounded px-3 py-2 text-sm text-ink-1 bg-off-white mb-1 focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="pl. GrowthFrame Q3 brand"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); if (e.key === 'Escape') setShowModal(false); }}
            />
            {createError && <p className="text-xs text-red-500 mb-2">{createError}</p>}
            <div className="flex gap-2 justify-end mt-4">
              <button
                className="text-xs px-3 py-1.5 rounded border border-rule text-ink-2 hover:bg-parchment"
                onClick={() => setShowModal(false)}
              >
                Mégsem
              </button>
              <button
                disabled={creating || !newTitle.trim()}
                className="text-xs px-4 py-1.5 rounded bg-primary text-sidebar-bg font-semibold disabled:opacity-50"
                onClick={() => void handleCreate()}
              >
                {creating ? 'Létrehozás…' : 'Létrehozás'}
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 5: TS check**

```bash
ssh ai-agency "cd /opt/marquee && npx tsc --noEmit -p packages/web/tsconfig.json 2>&1"
```

Várt: nincs hiba.

- [ ] **Step 6: Build + restart**

```bash
ssh ai-agency "cd /opt/marquee && npm run build 2>&1 | tail -10 && sudo systemctl restart marquee && sleep 3 && sudo systemctl is-active marquee"
```

Várt: build sikeres, service `active`.

- [ ] **Step 7: Manuális böngészős teszt**

1. Nyisd meg `http://marquee.lab2.home.arpa`
2. Navigálj a Kampányok oldalra
3. Kattints `+ Új kampány`
4. Írd be: "Teszt kampány"
5. Kattints Létrehozás
6. Várt: Workshop oldalra navigál, az input mező tartalmazza: "Tervezzük meg a Teszt kampány kampányt"
7. Vissza a Kampányok oldalra — a "Teszt kampány" megjelenik a listában

- [ ] **Step 8: Commit**

```bash
ssh ai-agency "cd /opt/marquee && git add packages/web/src/views/Campaigns.tsx && git commit -m 'feat(campaign): new campaign button + modal + workshop navigation'"
```

---

## Végső ellenőrzőlista

- [ ] `npx tsc --noEmit` zöld mindkét package-ben
- [ ] `npx vitest run` — campaigns.test.ts: 3 teszt, mind PASS
- [ ] Kampányok oldalon `+ Új kampány` gomb látható
- [ ] Modal megnyílik, cím megadható, Létrehozás működik
- [ ] 409 esetén hibaüzenet jelenik meg a modalban
- [ ] Sikeres létrehozás után Workshop oldalra navigál pre-filled üzenettel
