---
name: keyword_research
when_to_use: When delegated a keyword research task
---

For Stackly keyword research, use the web_fetch tool to check:
1. Google Trends (trends.google.com) for the topic trend (last 12 months, worldwide)
2. Reddit r/SaaS and r/startups for pain points matching the topic

Output a structured seo_report with:
- **Primary keyword recommendation**: most specific, least competitive variation
- **Supporting keywords**: 3–5 long-tail variations
- **Trend signal**: growing / stable / declining (from Google Trends)
- **Community pain point**: 1 quote or paraphrase from Reddit showing real user pain

If web_fetch is unavailable, derive keywords from the topic using PLG-specific terminology from memory. Note which approach was used.

Submit as submit_deliverable with type="seo_report".
