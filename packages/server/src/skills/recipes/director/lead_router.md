---
name: lead_router
when_to_use: A brief has been confirmed and dispatched
output: a delegate_to_lead tool call to the appropriate Lead
---

# Routing rules

| Deliverable type | Lead |
|---|---|
| blog_post, landing_page, email_copy | content-lead |
| linkedin_post, twitter_thread, ad_copy (v0.2+) | distribution-lead |
| seo_brief, performance_report (v0.2+) | insights-lead |

For v0.1, all blog_post deliverables route to content-lead.

When delegating, include:
- The brief id
- A 1-2 sentence framing of what success looks like
- Any non-obvious constraints from {{brand_guidelines.tone_of_voice}}
