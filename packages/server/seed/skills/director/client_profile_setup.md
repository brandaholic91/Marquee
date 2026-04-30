---
name: client_profile_setup
description: Ügyfél brand profil felépítése és memóriába mentése — onboarding és profil frissítés
---

Az operátorral végigmész egy 6-kérdéses interjún. **Egy kérdést tegyél fel egyszerre** — várd meg a választ, mielőtt a következőre lépsz. Ne rakj több kérdést egy üzenetbe. Magyar nyelven kommunikálsz végig.

## Az interjú menete

### 1. kérdés — Üzleti leírás
Tedd fel: "Mit csinál az ügyfél? Írj 1-2 mondatban: mit értékesítenek, kinek, és mi a fő tevékenységük."

A válasz alapján töltsd ki: `profile.md` → `business_description` mező (string, 1-2 tömör mondat).

### 2. kérdés — Célcsoport
Tedd fel: "Kik a célcsoport? Gondolj demográfiára (kor, nem, foglalkozás), érdeklődési körre és fájdalompontokra."

A válasz alapján töltsd ki: `profile.md` → `target_audience` mező (string tömb, 2-5 elem, pl. ["25-40 éves vállalkozók", "digitális átállás előtt állók"]).

### 3. kérdés — USP
Tedd fel: "Mi az USP, vagyis az egyedi versenyelőny? Miért választják az ügyfelet a versenytársak helyett?"

A válasz alapján töltsd ki: `profile.md` → `usp` mező (string, 1 tömör mondat).

### 4. kérdés — Versenytársak
Tedd fel: "Ki a 2-3 fő versenytárs? Csak a nevüket kérem."

A válasz alapján töltsd ki: `profile.md` → `competitors` mező (string tömb, pl. ["Versenytárs A", "Versenytárs B"]).

### 5. kérdés — Brand voice
Tedd fel: "Milyen a brand hangnem és stílusa? Kérlek jellemezd: formal vagy casual, milyen 3-5 jelzővel írható le, és van-e 1-2 inspiráló referencia brand (pl. Notion, Apple, Duolingo)?"

A válasz alapján töltsd ki a `brand_voice.md` fájl ÖSSZES mezőjét:
- `tone`: 1 összefoglaló mondat a hangnemről (pl. "barátságos-hozzáértő, közvetlen de szakmai")
- `adjectives`: 3-5 jelző tömb (pl. ["közvetlen", "lényegre törő", "inspiráló"])
- `reference_brands`: referencia brandek tömbje (pl. ["Notion", "Linear"])
- `do`: konkrét nyelvi szabályok, amiket be kell tartani (pl. ["tegező forma", "rövid mondatok", "aktív szerkezet"])
- `dont`: kerülendő dolgok (pl. ["bonyolult szakzsargon", "passzív ige", "puffogó frázisok"])

Ha az operátor nem említ referencia brandeket, hagyd üresen a `reference_brands` tömböt.

### 6. kérdés — Aktuális marketing cél
Tedd fel: "Mi az aktuális marketing célkitűzés? Van-e folyamatban lévő kampány vagy fókuszterület? (Pl. brand awareness, lead generálás, termékindítás)"

A válasz alapján töltsd ki: `ongoing_campaigns.md` → `campaigns` tömb első eleme:
```yaml
- name: "<kampány neve vagy 'Általános marketing'>"
  goal: "<a célkitűzés 1 mondatban>"
  started: "<mai dátum YYYY-MM-DD formátumban>"
  status: "active"
```

## propose_memory_update hívása

**Minden kérdés-válasz blokk után** hívd meg a `propose_memory_update` toolt az érintett fájlra. A hívásban add meg a fájl TELJES új tartalmát (nem patchet). Például a 4. kérdés után:

```json
{
  "filename": "profile.md",
  "content": "---\nbusiness_description: \"...\"\ntarget_audience: [\"...\", \"...\"]\nusp: \"...\"\ncompetitors: [\"...\", \"...\"]\n---\n\n<!-- Az ügyfél részletes profilja... -->"
}
```

Az 5. kérdés után a `brand_voice.md`-t frissítsd, a 6. kérdés után az `ongoing_campaigns.md`-t.

Ha az operátor valamelyik kérdésnél részleges választ ad, töltsd ki amit tudsz, és folytasd az interjút — ne várj tökéletes adatokra.

## Záró összefoglaló

Az interjú befejezése után írd: **"Felépítettem a brand profilját. Approve-old a queue-n. Mivel kezdjünk?"**

Ne adj hosszú összefoglalót, ne ismételd vissza az összes adatot — a záró mondat elég.

## Ismételhetőség

Ha az operátor újraindítja a skillt, hivatkozz a meglévő memóriára: "Van egy korábbi profil — csak a változásokat kérdezem végig." Ebben az esetben is hívj `propose_memory_update`-et a módosított fájlokra.
