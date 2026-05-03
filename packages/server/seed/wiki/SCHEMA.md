# Wiki Schema — MVP

## Alapelvek

A wiki az ügynökök által tanult tudásbázis. Három rétegű architektúra:
1. **RAW SOURCES** — immutable: artifacts, SQLite evals, Matomo data, events
2. **WIKI** — agent-maintained markdown
3. **SCHEMA** — agent discipline (ez a file)

## Core oldalak

### brand-voice-patterns.md
5/5 eval score-t kelt mondatok, csatornánként, és miért működnek.

**Update trigger:** eval_score == 5 (Brand Voice Guardian)  
**Update mode:** Automatic (ingest agent)

**Format:**
```
## [csatorna]
- Brief: [title]
- Pattern: [3-4 mondatos leírás a hook/angle-ról]
- Score: 5/5
- Link: [../artifacts/YYYY-MM-DD-filename.md]
```

**Anchor format:** Csatorna neve == markdown ## heading anchor  
**Removal strategy:** Amikor >10 entry per csatorna, távolítsd el a legrégebbit  
**Git commit:** `wiki: brand-voice-patterns — [brief title] 5/5`

### seo-learnings.md
Ranking data, competitive gap analysis, keyword strategies, insights.

**Update trigger:** seo-specialist submits research report (eval complete)  
**Update mode:** Proposal (ingest agent) → operátor approve

**Format:**
```
## [keyword]
- Status: ranking / no-rank
- Position: [N] (ha ranking)
- Search volume: [N]
- Competitive gap: [insight]
- Strategy: [akció]
- Link: [artifact]
```

### content-performance.md
Top 10 csatornánként (eval score >= 4). Legjobb performing anyagok.

**Update trigger:** Any deliverable eval >= 4  
**Update mode:** Automatic (ingest agent)

**Format:**
```
## [csatorna]
- [Brief title] — Score: [5/5 or 4/5] — [artifact link]
- [Brief title] — Score: [5/5 or 4/5] — [artifact link]
... (max 10 per csatorna)
```

## Linking Conventions

- **Wiki internal:** `[text](../brand-voice-patterns.md#linkedin)`
- **Artifact:** `[read](../artifacts/2026-05-01-filename.md)`
- **Date format:** YYYY-MM-DD (ISO)

---

## Operátor Workflow

**Ingest proposals queue:**
- Pending javaslatok megtekintése
- Preview: proposed wiki change
- Approve / Reject buttons
- ~30 sec/approval

**Git history:**
```bash
git log packages/server/seed/wiki/
git show <commit>
```
