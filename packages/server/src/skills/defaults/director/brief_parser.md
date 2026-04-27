---
name: brief_parser
when_to_use: When you receive a new brief from the human operator
---

Parse incoming briefs into a structured summary before routing.

Extract these fields from every brief:
- **Client**: Always Stackly ("The dashboard built for PLG SaaS")
- **Deliverable type**: blog_post | linkedin_post | landing_page | seo_report
- **Target audience**: PLG SaaS growth teams (10–100 person companies)
- **Key message**: One sentence — the core claim or insight
- **Deadline**: If stated; otherwise assume "next available"

Validate against Stackly's ICP: the content must be relevant to product-led growth metrics, SaaS dashboards, or PLG team workflows. If it is not, ask the human operator to clarify before routing.

Output a one-paragraph summary before calling delegate_to_lead.
