# Skill Backlog

Meglévő skill-ek átvizsgálása — mi hiányzik, milyen irányban kell bővíteni, mik a függőségek.

---

## director

### `brief_parser`
**Jelenlegi állapot:** Kinyeri a brief mezőit (client, deliverable type, audience, key message), validál ICP ellen.
**Bővítés:** A deliverable type felsorolás statikus — minden új deliverable típus bevezetésekor frissíteni kell. Hiányzó típusok: `email`, `twitter_thread`, `case_study`, `video_script`, `white_paper`, `ad_copy`, `instagram_caption`.
**Függőség:** Más skill-ek elkészültére vár.

### `lead_router`
**Jelenlegi állapot:** Blog/cikk → content-lead, LinkedIn/landing page → distribution-lead, SEO → insights-lead.
**Bővítés:** Routing tábla bővítése új típusokra:
- email, case_study, video_script, white_paper → content-lead
- twitter_thread, instagram_caption → distribution-lead
- ad_copy → paid-specialist
- performance report igény → analytics-analyst
- competitor analysis → insights-lead
**Függőség:** Más skill-ek elkészültére vár.

---

## content-lead

### `editorial_brief_handoff`
**Jelenlegi állapot:** Csak blog post briefing-et fed le.
**Bővítés:** Jelenleg hiányoznak az alábbi brief handoff skill-ek:
- `email_brief_handoff` — newsletter, nurture, promo email briefing a copywriternek
- `case_study_brief_handoff` — ügyfélsiker-sztori felépítése, szükséges inputok (kvóta, metrikák)
- `video_script_brief_handoff` — platform (YouTube, reel, webinar), hossz, struktúra, CTA
- `white_paper_brief_handoff` — kutatási kérdés, célközönség, hossz, referenciák

---

## copywriter

### `blog_post_writer`
**Jelenlegi állapot:** Jól lefedi a blog post struktúrát.
**Bővítés:** Új deliverable skill-ek szükségesek:
- `email_writer` — subject line, preview text, body struktúra, CTA; típusonként (newsletter / nurture / promo)
- `case_study_writer` — challenge → solution → results struktúra, kvóták, metrikák, social proof
- `video_script_writer` — hook, fejezetek, B-roll jelzések, CTA, hossz platformonként
- `white_paper_writer` — executive summary, research sections, conclusion, hivatkozások formátuma

---

## distribution-lead

### `landing_page_coordinator`
**Jelenlegi állapot:** Landing page struktúrát fed le jól.
**Bővítés:** `email_campaign_coordinator` — email sorozat tervezésének briefje: sequence logika, trigger feltételek, subject line irányelvek.

### `linkedin_brief_coordinator`
**Jelenlegi állapot:** LinkedIn briefing-et fed le jól.
**Bővítés:** Új csatorna koordinátor skill-ek:
- `twitter_brief_coordinator` — thread struktúra, tweet hossz, hook típusok, numbering, CTA az utolsó tweet-ben
- `instagram_brief_coordinator` — caption hossz, hashtag stratégia, carousel vs single image, story vs feed

---

## eval-judge

### `three_dim_review` + `three_dim_review_extended`
**Jelenlegi állapot:** Általános 3-dimenziós rubric (brand voice, factual accuracy, USP usage). LinkedIn-specifikus súlyok külön fájlban, de mindkettő mindig betöltődik — ez zajt okoz.
**Bővítés — magas prioritás:** Az audit spec szerint split szükséges:
- `eval_base` — általános elvárások, mindig betöltődik
- `eval_blog_post` — SEO-szempontok, hook minőség, CTA erőssége
- `eval_linkedin_post` — scroll-stop hook, karakter szám, engagement kérdés (a `three_dim_review_extended` tartalma)
- `eval_email` — subject line, open rate predikció, CTA klaritás
- `eval_case_study` — kvóta hitelessége, narrative ív, social proof erőssége
- `eval_video_script` — hook az első 5 másodpercben, retention struktúra, CTA timing
- `eval_landing_page` — headline klaritás, value prop, CTA above the fold
**Függőség:** Ehhez factory API változtatás is kell (`buildSystemPrompt` kapjon `deliverableType` paramétert az eval-judge esetén).

---

## insights-lead

### `seo_insights_coordinator`
**Jelenlegi állapot:** Koordinálja a keyword kutatást seo-analyst-on keresztül.
**Bővítés:**
- `competitor_insights_coordinator` — versenytárs tartalom és keyword gap elemzés koordinálása
- A jelenlegi skill bővíthető: content gap elemzés kérése a seo-analyst-tól, ha a brief alapján releváns

### `keyword_brief`
**Jelenlegi állapot:** Alap keyword brief formátum.
**Bővítés:** Szezonális kulcsszavak jelzése; versenytárs gap kulcsszavak jelölése ha competitor analysis is fut.

---

## seo-analyst

### `keyword_research`
**Jelenlegi állapot:** Google Trends + Reddit kutatás.
**Bővítés:**
- `competitor_analysis` — versenytárs domain-ek tartalom és keyword stratégiájának elemzése (web_fetch tool-lal elérhető)
- `content_gap_analysis` — milyen témákat fed le a verseny de a kliens nem; javasolt tartalom prioritások

### `on_page_audit`
**Jelenlegi állapot:** 7-pontos SEO checklist.
**Bővítés:**
- `technical_seo_audit` — page speed jelzők, schema markup megléte, mobile-friendliness (web_fetch-szel részben elérhető)
- `backlink_analysis` — hivatkozó domain minőség, anchor text megoszlás (külső tool szükséges)

---

## social-manager

### `linkedin_post_writer`
**Jelenlegi állapot:** LinkedIn post struktúrát fedi le jól.
**Bővítés:**
- `twitter_thread_writer` — thread struktúra, hook tweet, 8–12 tweet, numbering (1/n), lezáró CTA tweet
- `instagram_caption_writer` — hook az első sorban, rövid törzs, hashtag blokk, carousel esetén slide-onkénti irányelvek

---

## paid-specialist

### `campaign_brief_writer`
**Jelenlegi állapot:** Teljes kampány brief struktúra (goal, audience, platform, formats, budget, headlines, body, CTAs).
**Bővítés:**
- `ad_copy_writer` — tényleges hirdetésszöveg írása (nem brief): Google Search ad (RSA formátum, 15 headline + 4 description), Meta ad (primary text, headline, description, CTA label variánsok)
- `campaign_performance_analyzer` — futó kampány metrikák elemzése (CTR, CPC, ROAS), optimalizálási javaslatok

---

## repurposer

### `content_repurposer`
**Jelenlegi állapot:** LinkedIn, Twitter, email snippet, Instagram, custom csatornák le vannak fedve.
**Bővítés:** Minimális — esetleg `newsletter_repurposer` (hosszabb format, bevezető + kiemelt szakasz + CTA), vagy `podcast_shownotes` (fejezetcímek, időbélyegek, linkek). Nem sürgős.

---

## analytics-analyst

### `performance_report`
**Jelenlegi állapot:** Alap riport struktúra Matomo + SerpAPI adatokra.
**Bővítés — tool-függő:**
A skill bővítése előtt a `query_matomo` tool-t kell kibővíteni:
- `Actions.getPageUrls` API hívás a top pages valós adataihoz (jelenleg mindig üres tömb)
- `Referrers.get` — forgalomforrások (organic, direct, social, email)
- `Goals.get` — konverzió és goal completion adatok

Ha a tool bővül, a skill ezeket fedheti le:
- Referral sources szekció
- Conversion / goal completion szekció
- Period-over-period összehasonlítás kötelező elemként (jelenleg opcionális)
- Content attribution — melyik oldal/tartalom hozta a konverziókat

---

## Összefoglaló prioritások

| Prioritás | Feladat | Megjegyzés |
|---|---|---|
| 1 | eval-judge split | Audit óta ismert, factory változtatást igényel |
| 2 | email_writer + email_brief_handoff | Legegyetemesebb hiány |
| 3 | twitter_thread_writer + twitter_brief_coordinator | Második legfontosabb social csatorna |
| 4 | case_study_writer + case_study_brief_handoff | Értékesítési eszköz, általánosan szükséges |
| 5 | ad_copy_writer | paid-specialist jelenleg csak brief-et ír |
| 6 | competitor_analysis (seo-analyst) | Kutatási bővítés |
| 7 | query_matomo tool bővítés + performance_report skill | Tool-függőség miatt utoljára |
| – | brief_parser + lead_router frissítés | Mindig az új skill-ekkel együtt, nem önállóan |
