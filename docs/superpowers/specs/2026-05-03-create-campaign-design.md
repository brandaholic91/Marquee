# Közvetlen kampánylétrehozás — Design Spec

**Dátum:** 2026-05-03
**Branch:** feature/campaign-management

## Probléma

Kampányt jelenleg csak közvetve lehet létrehozni: egy brief javaslatakor a Director `propose_brief` toolt hívja `campaign_name` paraméterrel, vagy a brief szerkesztőben utólag állítható a `campaign_name`. Nincs közvetlen "Kampány létrehozása" lehetőség. Ez hiány különösen a Campaigns accordion oldal megléte esetén — a felhasználó nem tudja elkezdeni a tervezést, ha még nincs brief-je.

## Cél

A felhasználó közvetlenül hozzon létre kampányt a Campaigns oldalon, majd azonnal átkerüljön egy új Workshop chat threadbe ahol a Director segítségével tervezni tud.

## Architektúra

6 fájl érintett: 1 backend route bővítés, 1 test fájl, 4 frontend módosítás.

```
POST /api/campaigns       → campaigns.ts (új endpoint)
campaignsApi.create()     → api.ts (új metódus)
"Új kampány" gomb + modal → Campaigns.tsx
initialText prop          → ChatComposer.tsx
navigation state olvasás  → Workshop.tsx
```

## Backend

### `POST /api/campaigns`

**Request body:** `{ title: string }` — kötelező, nem üres string.

**Logika:**
1. Body validáció: ha `title` hiányzik vagy üres → 400 Bad Request
2. `INSERT INTO campaigns` — `clientSlug: 'default'`, `status: 'active'`, `createdAt: Date.now()`, `id: createId()`
3. Ha unique constraint sérül `(clientSlug, title)` → 409 Conflict `{ error: 'campaign_exists' }`
4. Sikeres → 201 Created `{ id, title, status, createdAt }`

A campaigns táblán van `uniqueIndex("uq_campaigns_client_title").on(t.clientSlug, t.title)` — a duplicate kezelést try/catch-el vagy az SQLite UNIQUE hibakód ellenőrzésével oldjuk meg.

### Test: `campaigns.test.ts`

Két új teszt a meglévő `describe` blokkba:
- `POST /api/campaigns` 201-et ad vissza, és a kampány visszajön `GET /api/campaigns`-re
- `POST /api/campaigns` 409-et ad ha a cím már létezik

## Frontend

### `api.ts` — `campaignsApi.create()`

Új metódus a `campaignsApi` objektumba:

```typescript
create: (title: string): Promise<{ id: string; title: string; status: string; createdAt: number }> =>
  post('/api/campaigns', { title }),
```

### `Campaigns.tsx` — gomb + modal

A komponens fejlécébe (`Kampányok` cím mellé) kerül egy `+ Új kampány` gomb.

A modal állapota inline (`useState<boolean>`) a `Campaigns.tsx`-ben — külön modal komponens nem szükséges (egyetlen input mező).

**Modal tartalma:** Kampány neve szövegmező + Létrehozás / Mégsem gomb.

**Létrehozás flow:**
1. `campaignsApi.create(title)` — POST a backendre
2. `await store.createThread()` — új Workshop thread létrehozása a Zustand store-on keresztül
3. `navigate('/', { state: { prefilledMessage: 'Tervezzük meg a [title] kampányt' } })` — navigáció a Workshopba

**Hibakezelés:** Ha a backend 409-et ad → hibaüzenet a modal alatt: "Ez a kampánynév már foglalt."

### `ChatComposer.tsx` — `initialText` prop

Az `initialText?: string` opcionális prop kerül a komponensbe:

```typescript
export function ChatComposer({
  placeholder = 'Írj a Directornak…',
  initialText,
}: {
  placeholder?: string;
  initialText?: string;
}) {
  const [text, setText] = useState(initialText ?? '');
  // ... rest unchanged
}
```

### `Workshop.tsx` — navigation state olvasás

```typescript
import { useLocation } from 'react-router-dom';
// ...
const location = useLocation();
const prefilledMessage = (location.state as { prefilledMessage?: string } | null)?.prefilledMessage;
```

A `prefilledMessage`-t prop-ként átadja a `ChatComposer`-nek:

```tsx
<ChatComposer initialText={prefilledMessage} />
```

## UX Flow összefoglalás

1. Felhasználó a Campaigns oldalon a `+ Új kampány` gombra kattint
2. Modal nyílik — megadja a kampány nevét (pl. "GrowthFrame Q3 brand")
3. Kattint a Létrehozásra
4. Háttérben: kampány létrejön az adatbázisban, új Workshop thread jön létre
5. Navigáció a Workshop oldalra (`/`)
6. Az input mező előre kitöltve: "Tervezzük meg a GrowthFrame Q3 brand kampányt"
7. Felhasználó Entert nyom — a Director elkezdi a kampánytervezést

## Nem tartalmaz (YAGNI)

- Kampány típus / státusz kiválasztása létrehozáskor (alapértelmezés: `active`)
- Sablon kiválasztás
- Egyéb kötelező mezők a cím mellett
