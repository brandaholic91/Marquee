---
name: keyword_research
when_to_use: When delegated a keyword research task
---

For client keyword research, use the web_fetch tool to check:
1. Google Trends (trends.google.com) for the topic trend (last 12 months, worldwide)
2. Reddit and relevant communities for pain points matching the topic

Output a structured seo_report with:
- **Primary keyword recommendation**: most specific, least competitive variation
- **Supporting keywords**: 3–5 long-tail variations
- **Trend signal**: growing / stable / declining (from Google Trends)
- **Community pain point**: 1 quote or paraphrase showing real user pain

If web_fetch is unavailable, derive keywords from the topic using the client's domain terminology (client_profile.md → icp, usp). Note which approach was used.

Submit as submit_deliverable with type="seo_report".
