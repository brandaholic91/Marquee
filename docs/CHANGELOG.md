# Changelog

## 2026-04-30

### Reszponzív layout
- Mobilon bottom tab bar váltja a sidebar-t (HQ / Workshop / Jóváhagy / Kampányok / Memória)
- Split-panel nézetek (Approvals, Memory, Campaigns) mobilon egyszerre egy panel, ← Vissza gombbal
- Workshop mobilon: ☰ gomb nyit egy thread drawer overlay-t

### Chat megjelenés
- Chat tartalom max-w-4xl (896px), középre igazítva — nem tölti ki a teljes képernyőt
- Fejléc és sidebarak rögzítve maradnak hosszú chat esetén is (h-screen overflow-hidden)

### Aktív agent státusz bug
- Specialisták korábban örökre "dolgozik…" állapotban ragadtak
- Javítva: `deliverable_submitted` és `review_completed` eseményekre törlődnek az `activeAgents`-ből

### Deliverable title mező
- Új `title` oszlop a `deliverables` táblában (migration 0004)
- Dispatch-kor automatikusan kitöltődik a brief nevéből
- Visszamenőleg backfillve a meglévő 15 deliverable-re
- Megjelenik: Approvals, Campaigns, HQ aktivitás feed
