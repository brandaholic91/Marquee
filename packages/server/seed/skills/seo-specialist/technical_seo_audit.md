---
name: technical_seo_audit
when_to_use: Egy weboldal technikai SEO auditját kell elvégezni és strukturált checklist-et adni
---

A technikai SEO audit **MAGYAR NYELVŰ**.

## Fontos disclaimer (az output ELEJÉN kötelező megjeleníteni)

> **Figyelem:** Ez az audit LLM-elemzés alapján készül, nem valós crawl-adat. Pontos adatokhoz Google Search Console, PageSpeed Insights, és Screaming Frog (vagy hasonló eszköz) szükséges. Az alábbi checklist **kiindulási lista** — nem helyettesíti az eszközalapú technikai auditot.

## Audit területek (mindegyikhez: státusz + javaslat + prioritás)

Prioritás: 🔴 Kritikus | 🟡 Közepes | 🟢 Alacsony

### 1. Site speed és Core Web Vitals
- LCP (Largest Contentful Paint)
- CLS (Cumulative Layout Shift)
- FID / INP (interaktivitás)
- Képoptimalizálás (WebP, lazy loading)

### 2. Indexálhatóság
- robots.txt — tilt-e fontos oldalakat?
- Sitemap.xml — létezik, elérhető, naprakész?
- Noindex tag-ek — helyesen vannak-e alkalmazva?

### 3. Mobile usability
- Responsive design
- Érintési célpontok mérete
- Viewport meta tag

### 4. Structured data (schema.org)
- Megfelelő schema típus az oldalhoz?
- Rich snippet lehetőségek (FAQ, Article, Product, stb.)

### 5. Crawl issues
- Törött linkek (404-es oldalak)
- Redirect chain-ek (3+ redirect lánc)
- Kanonikus URL-ek konzisztenciája

### 6. HTTPS és biztonság
- Mixed content (HTTP erőforrások HTTPS oldalon)
- SSL tanúsítvány lejárata

### 7. URL struktúra
- Slash konzisztencia
- Ékezetmentes, kötőjeles URL-ek
- Túl mélyen beágyazott oldalak

## submit_deliverable hívása

```json
{
  "content_md": "<teljes audit checklist dokumentum>",
  "structured_data": {
    "url_audited": "https://...",
    "critical_issues": ["issue1", "issue2"],
    "high_priority_count": 2,
    "medium_priority_count": 4,
    "low_priority_count": 5
  }
}
```

## Amit ne csinálj

- Soha ne hagyj el disclaimer-t az output elejéről — kötelező
- Ne állítsd, hogy valós adatok alapján auditálsz, ha az input csak URL
- Ne adj meg konkrét PageSpeed Insights pontszámokat (nincs valós mérés)
