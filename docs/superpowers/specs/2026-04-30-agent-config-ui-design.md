# Agent Konfiguráció UI — Design Spec

**Dátum:** 2026-04-30
**Státusz:** Jóváhagyva

## Összefoglalás

Új "Ügynökség" nézet a Marquee UI-ban: agent kártyák áttekintője, és per-agent konfiguráció oldal (identitás, skillek, beállítások). Ezzel párhuzamosan a skill betöltési rendszer áttér progressive disclosure-ra — a system promptba csak a skill catalog (frontmatter) kerül, a body on-demand töltődik be egy új `load_skill` tool segítségével.

## Scope

- 7 agent kártya az áttekintő oldalon (`ROLE_CONFIGS` alapján, nem hard-coded)
- Per-agent config oldal 3 füllel: Identitás · Skillek · Beállítások
- Új `identity.md` fájl per role (seedelve a meglévő `agents/defaults/`-ból)
- Skill progressive disclosure: catalog a promptban, body on-demand
- Új CRUD API route-ok az agent konfigurációhoz
- Sidebar + BottomNav bővítés

## Fájlrendszer

```
$DATA_DIR/
├── skills/<role>/*.md           — meglévő (CRUD mostantól UI-ból is)
└── agents/<role>/
    ├── identity.md              — ÚJ: az agent személyisége és szerepe
    └── config.json              — ÚJ: { model?: string, thinking_level?: string }
```

## Backend

### Seeding

Új `seedDefaultAgents(dataDir: string)` függvény az új `src/agents/loader.ts` fájlban:
- Forrás: `src/agents/defaults/<role>/identity.md` (az összes alkönyvtár iterálva)
- Cél: `$DATA_DIR/agents/<role>/identity.md`
- `force: false` — meglévő fájlt nem írja felül (mint `seedDefaultSkills`)
- Az `index.ts` startup-kor hívja, a `seedDefaultSkills` mellett

### Factory változások (`factory.ts`)

A system prompt összerakása az új sorrendben:

```
systemPrompt = [identityBlock, memoryBlock, brandVoiceBlock, brandVoiceInstructionBlock, skillCatalog].join("\n\n")
```

**identityBlock**: `$DATA_DIR/agents/<role>/identity.md` tartalma; ha hiányzik → üres string, spawn nem törik meg.

**skillCatalog**: csak frontmatter, XML-szerű formátumban:

```xml
<skills>
  <skill name="brief_parser">Parses an incoming brief: extracts client, deliverable type…</skill>
  <skill name="lead_router">Routes a parsed brief to the correct lead based on deliverable type…</skill>
</skills>
```

Új `loadSkillCatalog(dataDir, role)` függvény a `skills/loader.ts`-ben — csak frontmatter (name + description) iterál. A `loadSkillBody` megmarad (a `load_skill` tool használja). A `loadSkillRecipes` függvény megmarad a loader.ts-ben de a factory.ts többé nem hívja.

**`_common/brand_voice_instruction.md` kezelése**: A jelenlegi `loadSkillRecipes` a `skills/_common/brand_voice_instruction.md` fájlt is appendeli a skill body-khoz. Az új rendszerben ez fix blokkként töltődik be a system promptba, `brandVoiceInstructionBlock` névvel — a `brandVoiceBlock` és a `skillCatalog` közé kerül. Ha a fájl hiányzik, kihagyódik (nem végzetes). Brand-voice-guardian role-nál ez a blokk is kihagyódik.

**Config override**: a factory beolvassa `$DATA_DIR/agents/<role>/config.json`-t; ha létezik, a `model` és `thinking_level` felülírja az alapértelmezett `ROLE_MODEL`-t. Ha a fájl hiányzik, az alapértelmezett érvényes.

### `load_skill` tool

Minden rolehoz hozzáadva az eszközkészlethez:

```typescript
name: "load_skill"
description: "Load the full instructions for a skill by name. Call this when a task matches a skill's description and you need the detailed guidance."
input: { name: string }  // a skill neve a catalog-ból
execute: async ({ name }) => {
  const body = loadSkillBody(dataDir, role, name);
  return body ?? `Skill '${name}' not found.`;
}
```

A tool result bekerül a conversation-be; az agent a body alapján dolgozik tovább.

### Új API route-ok (`/api/agents`)

Új `agentsRoutes` plugin, regisztrálva a `buildServer`-ben.

| Method | Path | Leírás |
|---|---|---|
| `GET` | `/api/agents` | Összes agent listája: config + skill count + tools |
| `GET` | `/api/agents/:role/identity` | identity.md olvasás |
| `PUT` | `/api/agents/:role/identity` | identity.md írás |
| `GET` | `/api/agents/:role/skills` | Skill lista (frontmatter only: name, description) |
| `GET` | `/api/agents/:role/skills/:name` | Egy skill (frontmatter + body) |
| `PUT` | `/api/agents/:role/skills/:name` | Skill írás (frontmatter + body) |
| `POST` | `/api/agents/:role/skills` | Új skill létrehozása |
| `DELETE` | `/api/agents/:role/skills/:name` | Skill törlése |
| `GET` | `/api/agents/:role/config` | Modell + thinking_level override |
| `PUT` | `/api/agents/:role/config` | Modell + thinking_level mentése |

`GET /api/agents` válasz struktúra:

```json
[
  {
    "role": "director",
    "lifecycle": "warm",
    "model": "gpt-5.4",
    "thinkingLevel": "off",
    "tools": ["propose_brief", "read_memory", "get_campaign_status"],
    "skillCount": 3
  }
]
```

### Hibakezelés (backend)

| Szituáció | Viselkedés |
|---|---|
| `identity.md` hiányzik | `GET` → `{ body: "" }`; spawn nem törik |
| `config.json` hiányzik | Alapértelmezett `ROLE_MODEL` érvényes |
| `load_skill` ismeretlen névvel | `"Skill 'x' not found."` string visszaadva |
| Skill törlése közben aktív agent | Következő spawn-nál érvényes; nincs live invalidation |
| Érvénytelen role path param | 404 |

## Frontend

### Routing

```
/ugynokseg           → Agency.tsx      (áttekintő kártya grid)
/ugynokseg/:role     → AgentConfig.tsx (config oldal, tabs)
```

Mindkét route bekerül `App.tsx`-be.

### Navigáció

**Sidebar** (`Sidebar.tsx`): "Ügynökség" link `/ugynokseg`-re, a "Memória" alatt.

**BottomNav** (`BottomNav.tsx`): "Ügynökség" mint 6. elem.

### Agency.tsx — Áttekintő oldal

Kártya grid, 2 hasáb (mobilon 1 hasáb). Agent-ek száma: `ROLE_CONFIGS` kulcsaiból, nem hard-coded lista.

**Egy kártya tartalma:**

```
┌──────────────────────────────────────────┐
│  ● Director                           ›  │
│  Stratégiai orchestrátor, brief…         │
│                                          │
│  [warm] [gpt-5.4]   3 skill             │
│  Tools: propose_brief, read_memory, …   │
└──────────────────────────────────────────┘
```

- **Bulb jelző**: `useMarqueeStore(s => s.activeAgents)` (már létezik)
- **Leírás**: `GET /api/agents` válaszában `description` mező — az `identity.md` első nem-üres bekezdése, max 100 karakter. Ha identity.md üres, statikus fallback a `ROLE_CONFIGS`-ból.
- **Lifecycle badge**: `ROLE_CONFIGS[role].lifecycle`
- **Modell**: `GET /api/agents` válaszából (config override vagy default)
- **Skill count**: `GET /api/agents` válaszából
- **Tools**: `ROLE_CONFIGS[role].tools`, vesszővel elválasztva; max 3 látható, "+N" csonkítás

Kattintásra: `navigate("/ugynokseg/:role")`.

### AgentConfig.tsx — Konfig oldal

**Topbar**: `← Ügynökség` back link + agent neve + lifecycle badge.

**Fülek**: Identitás · Skillek · Beállítások

---

#### Identitás fül

- `<textarea>` a `identity.md` body-jával (monospace font, resize: vertical)
- Betöltés: `GET /api/agents/:role/identity`
- Mentés gomb → `PUT /api/agents/:role/identity`
- Unsaved changes jelzés: ha a textarea értéke eltér a betöltötttől, a "Mentés" gomb aktív / fejléc jelzi

---

#### Skillek fül

Skill kártya grid (2 hasáb). Minden kártya:

```
┌──────────────────────┐
│ brief_parser         │
│ Parses an incoming…  │
│ [Szerkesztés]        │
└──────────────────────┘
```

Betöltés: `GET /api/agents/:role/skills` (frontmatter only — name + description).

**+ Új skill** gomb a grid alatt.

**Szerkesztő modal** (meglévő vagy új skill esetén):

```
Skill neve:    [ brief_parser        ]  ← readonly ha meglévő
Leírás:        [ Parses an incoming… ]  ← frontmatter description
Body:
┌─────────────────────────────────────┐
│ Elemezd a beérkező briefingeket…    │
│ ...                                 │
└─────────────────────────────────────┘
[ Mentés ]  [ Törlés ]  [ Mégse ]
```

- Mentés: `PUT` (meglévő) vagy `POST` (új). Új skill fájlneve: `<name>.md` ahol `name` a frontmatter name mező értéke.
- Törlés: megerősítő confirm dialóg, majd `DELETE`
- Body betöltés: `GET /api/agents/:role/skills/:name` (csak modal megnyitáskor, a kártya listája frontmatter-only)

---

#### Beállítások fül

```
Modell:             [ gpt-5.4 ▾ ]
Gondolkodási szint: [ Ki ▾      ]

[ Mentés ]
```

- Ha nincs override → az alapértelmezett érték jelenik meg placeholderként
- Modell opciók: `gpt-5.4-mini`, `gpt-5.4`, `gpt-5.5` (+ "alapértelmezett" opció = törlés)
- Thinking level opciók: `off`, `minimal`, `low`, `medium`, `high`
- Mentés → `PUT /api/agents/:role/config`

### API kliens (`lib/api.ts`)

```typescript
agents: {
  list(): Promise<AgentSummary[]>
  getIdentity(role: string): Promise<{ body: string }>
  putIdentity(role: string, body: string): Promise<void>
  listSkills(role: string): Promise<SkillMeta[]>           // { name, description }[]
  getSkill(role: string, name: string): Promise<SkillFull> // { name, description, body }
  putSkill(role: string, name: string, data: SkillFull): Promise<void>
  postSkill(role: string, data: SkillFull): Promise<void>
  deleteSkill(role: string, name: string): Promise<void>
  getConfig(role: string): Promise<AgentConfig>
  putConfig(role: string, config: AgentConfig): Promise<void>
}
```

### Hibakezelés (frontend)

| Szituáció | UI viselkedés |
|---|---|
| API hiba mentéskor | Toast értesítés, form marad nyitva |
| Skill törlés megerősítés | confirm dialóg mielőtt DELETE |
| Identitás fájl üres | Üres textarea, placeholder szöveggel |
| Config nincs override | Dropdown az alapértelmezett értéket mutatja |

## Adatfolyam összefoglalás

```
Startup:
  seedDefaultAgents() → $DATA_DIR/agents/<role>/identity.md (ha még nem létezik)

Agent spawn:
  identity.md → identityBlock
  memory fájlok → memoryBlock
  brand_voice_guidelines.md → brandVoiceBlock
  skills/*.md frontmatter → skillCatalog
  agents/<role>/config.json → model + thinking_level override
  systemPrompt = join([identity, memory, brandVoice, catalog])
  tools = [...meglévő toolok, load_skill]

Runtime (skill aktiválás):
  Agent hívja: load_skill({ name: "lead_router" })
  → loadSkillBody() → body string → tool result a conversation-ben
```

## Tesztelés

**Backend unit tesztek** (Vitest, `packages/server`):
- `loadSkillCatalog()`: a kimenetben csak frontmatter (name + description) szerepel, body nem
- `loadSkillBody()`: helyes body, frontmatter nélkül
- `seedDefaultAgents()`: identity fájlok létrejönnek; meglévő fájlt nem írja felül
- `load_skill` tool execute: létező skill → body string; ismeretlen névnél error string

**Route tesztek** (a meglévő `*.test.ts` mintájára):
- CRUD minden endpoint-ra: GET/PUT identity, GET/PUT/POST/DELETE skills, GET/PUT config
- Érvénytelen role → 404
- Hiányzó `config.json` → alapértelmezett értékek

**Frontend**: nincs automatizált teszt (konzisztens a jelenlegi codebase-szel).

## Nem változik

- Memory rendszer (olvasás, javaslatok, szerkesztés) — érintetlen
- Brand voice injection logikája — érintetlen
- Broker, SSE, webhook — érintetlen
- DB séma — nincs változás
