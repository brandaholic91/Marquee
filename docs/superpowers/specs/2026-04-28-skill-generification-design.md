# Marquee — Skill Hardcode Generifikálás

**Dátum:** 2026-04-28
**Státusz:** jóváhagyva
**Kapcsolódó:** `2026-04-28-prompt-architecture-audit.md`

---

## Goal

A jelenlegi default skill fájlokból eltávolítani a Stackly-specifikus hardcode-okat, és helyettük memory-hivatkozásokat + generikus sablon-példákat bevezetni. Az agensek a kliens-specifikus tudást futásidőben a memory blokkból olvassák, nem a skill szövegéből.

## Nem változik

- A skill fájlok struktúrája, frontmatter formátuma
- A formátumszabályok (szószám, karakterszám, H-struktúra)
- Az output contractok (`submit_deliverable`, `submit_eval_report`)
- A memory injection mechanizmus (`transform-context.ts`)
- A skill loader és a factory (`loader.ts`, `factory.ts`)

---

## Memory hivatkozás minta

Egységes nyelv minden érintett fájlban:

| Régi (Stackly-specifikus) | Új (generikus memory-hivatkozás) |
|---|---|
| `Stackly` | `the client (client_profile.md → client_name)` |
| `PLG SaaS growth teams` | `the client's target audience (client_profile.md → icp)` |
| `"The dashboard built for PLG SaaS"` | `the client's USP (client_profile.md → usp)` |
| `Lenny's Newsletter, Reforge` | `brand_guidelines.md → tone_of_voice, reference_posts` |
| `stackly.io` | `the client's website (client_profile.md)` |
| `"PLG dashboard", "activation rate SaaS", …` | `derive from client_profile.md → icp, usp, competitors` |

## Generikus példák mintája

Ahol a skill-ek korábban Stackly-specifikus hook- vagy title-példákat tartalmaztak, ezentúl generikus sablont kapnak 2-3 konkrét `e.g.`-vel:

```
- "[Target audience] are [doing common thing] wrong. Here's why."
  e.g. "Growth teams are measuring activation rate wrong. Here's why."
- "We talked to [N] [personas]. [X]% do [A]. [Y]% do [B]. Here's the difference."
  e.g. "We talked to 50 founders. 80% track revenue. 20% track activation. Here's what changes."
```

---

## Érintett fájlok és változtatások

### `director/brief_parser.md`

- `"Client: Always Stackly ('The dashboard built for PLG SaaS')"` →
  `"Client: use client_name from client_profile.md"`
- `"Target audience: PLG SaaS growth teams (10–100 person companies)"` →
  `"Target audience: use the client's icp from client_profile.md"`
- ICP-validáció szövege: `"must be relevant to product-led growth metrics, SaaS dashboards, or PLG team workflows"` →
  `"validate against the client's ICP (client_profile.md → icp). If the content doesn't fit, ask the human operator to clarify."`

### `director/lead_router.md`

- `"Routing rules for Stackly briefs"` → `"Routing rules"` (csak a fejléc)

### `content-lead/editorial_brief_handoff.md`

- `"for a Stackly blog post"` → `"for a client blog post"`
- PLG angle-példa → generikus sablon + 2 `e.g.`
- `"Brand voice: Terse, data-driven, no fluff. Reference style: Lenny's Newsletter, Reforge."` →
  `"Brand voice and reference style: follow brand_guidelines.md → tone_of_voice, reference_posts"`
- `"Stackly USP to weave in: 'The dashboard built for PLG SaaS'"` →
  `"Client USP to weave in: use the client's USP from client_profile.md → usp, mention naturally in context, not as an ad"`
- `"invite readers to explore Stackly, no hard sell"` →
  `"invite readers to explore the client's product, no hard sell"`

### `copywriter/blog_post_writer.md`

- `"Write every Stackly blog post"` → `"Write every blog post"`
- H1-példa: PLG-specifikus title → `"How [Target Audience] Solve [Problem] Without [Common Workaround]"` + 1 `e.g.`
- `"Use real PLG metrics as examples: activation rate, PQL, expansion MRR, feature adoption"` →
  `"Use metrics and examples relevant to the client's domain (client_profile.md → icp)"`
- CTA: `"If you're building a PLG motion, [Stackly](https://stackly.io) was designed for exactly this."` →
  `"Soft CTA to the client's product (use URL and positioning from client_profile.md)"` + 1 generikus `e.g.`
- `"Voice: Lenny's Newsletter meets Reforge. Authoritative but not corporate."` →
  `"Voice: follow brand_guidelines.md → tone_of_voice and reference_posts"`

### `distribution-lead/landing_page_coordinator.md`

- `"For Stackly landing pages"` → `"For client landing pages"`
- `"H1 (PLG-specific claim)"` → `"H1 (client-specific claim — use ICP pain points from client_profile.md → icp)"`
- `"3 pain points that PLG teams face with fragmented dashboards"` →
  `"3 pain points the target audience faces (client_profile.md → icp)"`
- `"How Stackly solves each pain point — specific feature callouts"` →
  `"How the client's product solves each pain point (client_profile.md → usp)"`

### `distribution-lead/linkedin_brief_coordinator.md`

- `"for every Stackly LinkedIn post"` → `"for every client LinkedIn post"`
- `"a contrarian take on a common PLG belief"` →
  `"a contrarian take on a common belief in the client's domain"`
- `"One specific PLG insight (activation rate tracking, PQL definition, expansion MRR)"` →
  `"one specific insight relevant to the client's domain (client_profile.md → icp)"` + 2 `e.g.`
- `"a link to the Stackly blog post this is repurposing"` →
  `"a link to the client's relevant content"`

### `eval-judge/three_dim_review.md`

- Brand voice scoring:
  - `"reads like Lenny's Newsletter. No fluff."` → `"matches brand_guidelines.md → tone_of_voice. No fluff."`
- USP scoring:
  - `"'PLG SaaS dashboard' wedge appears naturally and reinforces the content's message."` →
    `"client's USP (client_profile.md → usp) appears naturally and reinforces the content's message."`
  - `"Stackly mentioned but the PLG angle is weak."` → `"Client USP mentioned but the positioning angle is weak."`
  - `"No mention of PLG or Stackly's specific positioning."` → `"No mention of the client's specific positioning."`

### `eval-judge/three_dim_review_extended.md`

- USP scoring:
  - `"Stackly's PLG angle woven into the insight naturally — not forced"` →
    `"Client's positioning angle (client_profile.md → usp) woven into the insight naturally — not forced"`
  - `"Stackly mentioned but as an afterthought"` → `"Client mentioned but as an afterthought"`
  - `"No PLG positioning, could be any SaaS company's post"` →
    `"No client-specific positioning, could be any company's post"`

### `insights-lead/seo_insights_coordinator.md`

- `"for Stackly content"` → `"for client content"`
- `"Stackly's ICP (PLG SaaS growth teams)"` → `"the client's ICP (client_profile.md → icp)"`
- Hardcoded keyword lista (`"PLG dashboard"`, `"activation rate SaaS"`, stb.) →
  `"derive initial keyword directions from client_profile.md → icp, usp, competitors"`

### `insights-lead/keyword_brief.md`

- `"[existing Stackly blog posts or pages — if none, note 'TBD']"` →
  `"[existing client pages — check content_history.md if available, otherwise note 'TBD']"`

### `seo-analyst/keyword_research.md`

- `"For Stackly keyword research"` → `"For client keyword research"`
- `"derive keywords from the topic using PLG-specific terminology from memory"` →
  `"derive keywords from the topic using the client's domain terminology (client_profile.md → icp, usp)"`

### `seo-analyst/on_page_audit.md`

- `"for every Stackly page"` (2×) → `"for every client page"`

### `social-manager/linkedin_post_writer.md`

- `"Write every Stackly LinkedIn post"` → `"Write every client LinkedIn post"`
- Hook-példák (Stackly/PLG tartalom) → generikus sablon + 2 `e.g.`
- Engagement CTA: `"What does activation rate look like at your company?"` →
  `"[question relevant to the client's domain, e.g. 'What does activation rate look like at your company?']"`
- `"Full breakdown on the Stackly blog — link in comments"` →
  `"Full breakdown on the client's blog — link in comments"`

### `analytics-analyst/performance_report.md`

Nincs Stackly-hivatkozás. Nem változik.

### `paid-specialist/campaign_brief_writer.md`

- `client_profile.icp` → `client_profile.md → icp` (formátum egységesítés)

### `repurposer/content_repurposer.md`

- `client_profile.brand_voice` → `brand_guidelines.md → tone_of_voice` (egységes mező-hivatkozás)
- `client_profile.icp` → `client_profile.md → icp` (formátum egységesítés)

---

## Testing

Manuális ellenőrzés: minden módosított fájlban `grep -i stackly` 0 találatot ad.

Nincs automatizált teszt — a skill fájlok markdown tartalmak, nem runtime logika.
