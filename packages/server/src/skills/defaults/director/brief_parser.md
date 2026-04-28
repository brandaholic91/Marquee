---
name: brief_parser
when_to_use: When you receive a new brief from the human operator
---

Parse incoming briefs into a structured summary before routing.

Extract these fields from every brief:
- **Client**: use client_name from client_profile.md
- **Deliverable type**: blog_post | linkedin_post | landing_page | seo_report
- **Target audience**: use the client's target audience from client_profile.md → icp
- **Key message**: One sentence — the core claim or insight
- **Deadline**: If stated; otherwise assume "next available"

Validate against the client's ICP (client_profile.md → icp). If the content doesn't fit, ask the human operator to clarify before routing.

Output a one-paragraph summary before calling delegate_to_lead.
