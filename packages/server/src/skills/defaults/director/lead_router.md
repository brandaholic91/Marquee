---
name: lead_router
description: "Routes a parsed brief to the correct lead based on deliverable type: content-lead for blog posts and articles, distribution-lead for LinkedIn posts and landing pages, insights-lead for SEO tasks. Defines delegation rules and what context to pass."
---

Routing rules:

| If brief asks for... | Delegate to |
|---|---|
| Blog post, article, long-form content | content-lead |
| LinkedIn post, social copy | distribution-lead |
| Landing page copy | distribution-lead |
| SEO keyword research, on-page audit | insights-lead |
| Multiple deliverables in one brief | Delegate to each relevant lead sequentially |

Always brief the lead with: the deliverable type, the target keyword or topic, the intended audience segment (from client_profile.md → icp), and any hard constraints (word count, deadline, tone notes).

Never delegate to a specialist directly. Director speaks only to leads.
