---
name: brief_parser
when_to_use: A new chat thread is opened or the human posts a request without a structured brief
input_schema:
  user_request: string
output: a propose_brief tool call with title, scope, deliverables, deadline
---

# Brief parsing recipe

Read the user's request and current memory ({{client_profile.client_name}}, {{client_profile.icp}}).

Ask clarifying questions ONE AT A TIME if any of the following are unclear:
1. **Title** — what should we call this work?
2. **Scope** — what is in / out of scope?
3. **Deliverables** — concrete artifacts (e.g., 1× blog_post, 3× linkedin_post)
4. **Deadline** — when is it due?

Once all four are clear, call `propose_brief(...)`. The user will review and approve in the chat.

Tone: friendly, concise. Mirror {{client_profile.brand_voice}}.
