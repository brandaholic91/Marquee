# SEO → Copywriter handoff + skill rename

**Dátum:** 2026-04-30
**Státusz:** approved

## Összefoglalás

Jelenleg ha az operátor jóváhagy egy SEO content briefet, semmi nem triggerelődik — manuálisan kell a Directornak megmondani, hogy adja át a Copywriternek. Ez a spec az automatikus (de operátor-jóváhagyásos) handoff mechanizmust, az ehhez szükséges deliverable típus-bővítést, a transform-context injektálást, az új Copywriter skill-t, és az összes skill fájl angol átnevezését fedi le.

---

## 1. DB + séma változások

### 1.1 Új deliverable típusok

`deliverables.type` enum bővítése:
- `content_brief_seo` — SEO Specialist által készített, Copywriternek átadható content brief
- `seo_report` — SEO munkatermék (keyword research, on-page ajánlás, technikai audit)

### 1.2 Új mező a `briefs` táblán

```sql
ALTER TABLE briefs ADD COLUMN parent_deliverable_id TEXT
  REFERENCES deliverables(id) ON DELETE SET NULL;
CREATE INDEX idx_briefs_parent_deliverable ON briefs(parent_deliverable_id);
```

`ON DELETE SET NULL` — ha a forrás deliverable törlődik, a brief megmarad, csak elveszti a referenciát.

A mező neve szándékosan általános (`parent_deliverable_id`, nem `seo_brief_id`) — jövőbeli handoff pároknál (pl. Copywriter → Email Marketer) ugyanez a mező használható.

### 1.3 Migration

`packages/server/drizzle/0005_handoff.sql`

---

## 2. Agent config változások

`seo-specialist` `produces` frissítése:
```typescript
produces: ['seo_report', 'content_brief_seo']
```

A három meglévő SEO skill (`keyword_research`, `on_page_seo_recommendation`, `technical_seo_audit`) `seo_report` típusú deliverable-t ad le. A `content_brief_seo` skill `content_brief_seo` típusút.

---

## 3. Skill fájl átnevezések

Az összes skill fájlnév angolra egységesítve (underscore szeparátor, lowercase):

| Jelenlegi | Új |
|---|---|
| `brand-voice-guardian/brand_voice_ellenorzes.md` | `brand_voice_review.md` |
| `email-marketer/drip_sorozat_tervezes.md` | `drip_sequence_planning.md` |
| `email-marketer/hirlevel_iras.md` | `newsletter_writer.md` |
| `email-marketer/transactional_email_szoveg.md` | `transactional_email_writer.md` |
| `seo-specialist/kulcsszo_kutatas.md` | `keyword_research.md` |
| `seo-specialist/technikai_seo_audit.md` | `technical_seo_audit.md` |

Minden fájlban a `name:` frontmatter mező is frissül az új fájlnévvel.

### 3.1 Új skill: `copywriter/seo_article_writer.md`

Előfeltétel: `parent_deliverable_id` kötelező (SEO content brief).

Kötelező output elemek:
- Primary keyword a H1-ben, az első 100 szóban és a meta descriptionben
- H-struktúra kövesse a SEO brief javaslatát (H2-k, H3-ak)
- Szóhossz a SEO brief által javasolt range-en belül (±10%)
- Ha a SEO brief FAQ-t javasol, az szerepeljen

Ha nincs `parent_deliverable_id` a brief contextuban, a skill utasítja az agentet, hogy ne kezdjen cikket írni — először kérjen SEO content briefet.

---

## 4. Handoff endpoint

`POST /api/deliverables/:id/handoff`

**Request body:**
```typescript
{
  target_role: 'copywriter',
  brief_overrides?: {
    title?: string,
    description?: string,
    campaign_name?: string,
  }
}
```

**Response:**
```typescript
{ brief_id: string }
```

**Logika:**
1. Validálás: `deliverable.type === 'content_brief_seo'`, egyébként 400
2. Aktuális revision artifact fájl kiolvasása
3. Új brief létrehozása `draft` státuszban:
   - `target_specialist: 'copywriter'`, `deliverable_type: 'blog_post'`
   - `parent_deliverable_id` = forrás deliverable ID
   - `title` = `brief_overrides.title` vagy `structured_data.primary_keyword` + " — SEO cikk"
   - `body` = a SEO brief teljes szövege
   - `campaign_id` = forrás deliverable kampánya (ha van)
4. Visszaad `{ brief_id }`

**Nem auto-dispatch** — az operátor a brief proposal nézetben átnézi, szerkeszti, majd approve-olja. Approve után a meglévő `dispatchBrief` flow fut le változatlanul.

---

## 5. `transform-context.ts` változás

Ha a brief-nek van `parent_deliverable_id`, a specialist system promptjába injektálódik:

```
=== FORRÁS DELIVERABLE ===
[parent deliverable szövege]
=== / FORRÁS DELIVERABLE VÉGE ===

=== AKTUÁLIS BRIEF ===
[brief leírása]
=== / AKTUÁLIS BRIEF VÉGE ===
```

Ha nincs `parent_deliverable_id`, a jelenlegi viselkedés változatlan (csak `=== AKTUÁLIS BRIEF ===` blokk).

---

## 6. Frontend változások

### 6.1 `DeliverableDetail` view

Conditional rendering: ha `deliverable.type === 'content_brief_seo'`, megjelenik az **"Átadás Copywriter-nek"** gomb az akció sorban.

Klikk → modal:
- **Cím** (default: `structured_data.primary_keyword` vagy deliverable title)
- **Kampány** (default: deliverable kampánya)
- **Leírás override** (textarea, elhagyható)
- "Átadás" + "Mégse" gombok

Submit → `POST /api/deliverables/:id/handoff` → navigálás a brief proposal nézetbe.

### 6.2 Brief proposal nézet

Ha a brief-nek van `parent_deliverable_id`: **"Forrás: SEO brief →"** badge/link a brief kártyán, ami visszamutat a forrás deliverable-re.

### 6.3 `api.ts`

Új `handoffDeliverable(id, body)` függvény.

---

## 7. Hatókörön kívül

- Más handoff párok (Copywriter → Email Marketer stb.) — `parent_deliverable_id` mező már általános, de az endpoint és UI csak SEO → Copywriter irányra van implementálva
- Auto-handoff (operátor jóváhagyás nélkül)
- `seo_report` típusú deliverable-ek handoff-ja
