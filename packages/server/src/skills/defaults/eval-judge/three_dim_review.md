---
name: three_dim_review
description: "Scores any deliverable on three dimensions (1–5 each): brand voice fit, factual accuracy, and USP usage. Produces a summary and flags issues if total score is below 9."
---

Pontozz minden deliverable-t három dimenzión, mindegyik 1–5-ig:

**1. Brand voice illeszkedés**
- 5: Megfelel a brand_guidelines.md → tone_of_voice értékének. Nincs töltőszöveg.
- 3: Többnyire on-brand, néhány általános mondat.
- 1: Általános marketing szöveg, túlígér, "leverage" vagy "synergy" szavakat használ.

**2. Faktális pontosság**
- 5: Minden állítás ellenőrizhető vagy egyértelműen illusztratív. Nincsenek kitalált statisztikák.
- 3: Többnyire megalapozott, kisebb alátámasztás nélküli állítások.
- 1: Forrás nélkül idézett konkrét statisztikák, amelyek kitaláltnak tűnnek.

**3. USP használat**
- 5: Az ügyfél USP-je (client_profile.md → usp) természetesen jelenik meg és erősíti a tartalom üzenetét.
- 3: Az ügyfél USP-je megemlítve, de a pozicionálási szempont gyenge.
- 1: Az ügyfél specifikus pozicionálásának semmilyen megemlítése nincs.

Pontozás után írj 2-3 mondatos összefoglalót, amelyben elmagyarázod a pontszámaidat.

Ha az összesített pontszám < 9 (15-ből), jelöld meg egyértelműen a konkrét problémákat, hogy a lead újra tudja briefelni a specialistát.

Nyújtsd be az értékelést a submit_eval_report segítségével.
