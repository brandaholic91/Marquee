# Deliverables oldal — Design Spec

**Dátum:** 2026-05-03
**Státusz:** Approved
**Szerző:** Balázs + Claude

## Összefoglaló

Új `/deliverables` oldal a Marquee-ban: szűrhető, táblázatos nézet az összes deliverable áttekintéséhez. A jelenlegi Jóváhagyások oldal megmarad változatlanul (cselekvés helye) — ez az oldal az áttekintésé és keresésé.

## Motiváció

A Jóváhagyások oldal jelenleg szűrés nélkül listázza az összes deliverable-t egymás alá. Az új oldal lehetővé teszi típus, kampány, időszak és státusz szerinti szűrést egy kompakt táblázatos nézetben.

## Navigáció

Új sidebar item: "Deliverables" (`/deliverables`), a Jóváhagyások után.

Érintett fájlok:
- `packages/web/src/components/Sidebar.tsx`
- `packages/web/src/components/MobileNavMenu.tsx`
- `packages/web/src/App.tsx`

## Szűrők

A táblázat felett egy szűrősávban, egymás mellett:

| Szűrő | Típus | Értékek | Default |
|---|---|---|---|
| Státusz | Pill-gombok | `shipped` / `awaiting_approval` / `discarded` | `shipped` aktív |
| Típus | Dropdown | Mind + 6 deliverable típus | Mind |
| Kampány | Dropdown | Mind + kampányok neve | Mind |
| Időszak | Dropdown | Ma / Ez a hét / Ez a hónap / Összes | Összes |

A szűrők kliens oldalon működnek — az összes deliverable egyszer töltődik be, a szűrés lokálisan történik.

## Táblázat

Oszlopok:

| Oszlop | Forrás | Megjegyzés |
|---|---|---|
| Cím | `title ?? type` | Kattintható sor |
| Típus | `type` | `TypeBadge` komponens |
| Kampány | `campaignId` -> kampánynév | `—` ha nincs kampány |
| Státusz | `status` | `StatusBadge` komponens |
| Dátum | `updatedAt` | `YYYY-MM-DD HH:mm` formátum |

Rendezés: `updatedAt` descending, fix. Lapozás nincs — a szűrők tartják kezelhetőn a listaméretét.

Ha az aktív szűrőkombinációra nincs találat, üres állapot jelenik meg (`EmptyState` komponens).

## Részlet megnyitása

Sorra kattintva navigál: `navigate('/jovahagyas/' + id)`. A részletnézetet az Approvals oldal kezeli — nem kell újraírni.

## Adatbetöltés

Két párhuzamos API hívás az oldal mountolásakor:

1. `GET /api/deliverables` — az összes deliverable (meglévő endpoint, szűrő nélkül)
2. `GET /api/campaigns` — kampányok listája, `id -> name` map felépítéséhez

Nincs új backend endpoint.

## Komponens struktúra

```
Deliverables.tsx
  ├── szűrősáv (lokális state: statusFilter, typeFilter, campaignFilter, periodFilter)
  ├── táblázat
  │   └── soronként: TypeBadge, StatusBadge
  └── EmptyState (ha nincs találat)
```

## Érintett fájlok

| Fájl | Változás |
|---|---|
| `packages/web/src/views/Deliverables.tsx` | Új fájl |
| `packages/web/src/App.tsx` | Új route: `/deliverables` |
| `packages/web/src/components/Sidebar.tsx` | Új nav item: "Deliverables" -> `/deliverables` |
| `packages/web/src/components/MobileNavMenu.tsx` | Új nav item |

## Hatókörön kívül

- Rendezés oszlopra kattintva — első verzióban nem szükséges
- Lapozás / végtelen scroll — a szűrők elegendők
- Exportálás (CSV stb.)
- Inline akciók a táblázatból (jóváhagy, eldob) — ezek maradnak az Approvals oldalon
