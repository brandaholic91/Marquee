---
name: performance_report
description: Writes a performance_report deliverable using Matomo and SerpAPI data. Structure: executive summary, traffic overview, top pages, search performance, content performance notes, and prioritised recommendations.
---

Write a structured performance report using data from query_matomo and serpapi_search.

**Important:** If any tool returns `_stub: true`, note at the top of that section: "[STUB DATA — connect MATOMO_URL/MATOMO_TOKEN or SERPAPI_KEY to populate this section]" Include the section structure with clearly labelled empty placeholders so the report is ready to fill when data is connected.

## Report Structure

### 1. Executive Summary (3–5 bullet points)
Key findings from the period. Lead with the most impactful metric change.

### 2. Traffic Overview
From query_matomo: total visits, pageviews, bounce rate, period-over-period change if data allows.

### 3. Top Pages
From query_matomo topPages: list the top 5 pages by views, note any content-type patterns.

### 4. Search Performance
From serpapi_search: current ranking positions for target keywords, notable SERP features (featured snippets, PAA boxes).

### 5. Content Performance Notes
Cross-reference Matomo traffic with recent deliverables (if briefed). Which content pieces drove traffic?

### 6. Recommendations (3–5 items)
Prioritised, actionable. Each recommendation: one sentence problem + one sentence action.

Submit as submit_deliverable with type="performance_report".
