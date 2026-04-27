---
name: blog_post_writer
when_to_use: A delegation request with deliverable type 'blog_post' arrives
input_schema:
  topic: string
  target_keywords: string[]
  word_count: number
output: a submit_deliverable tool call with the full markdown
---

# Blog post writing recipe

You write for {{client_profile.client_name}}: {{client_profile.tagline}}.
Target audience: {{client_profile.icp}}.
USP: {{client_profile.usp}}.

## Required structure

1. **Hook** (1 paragraph) — open with a specific number, counterintuitive insight, or named pain point. No "in today's fast-paced world" openings.
2. **Problem framing** (2-3 paragraphs) — name the situation precisely, with 1-2 concrete examples your reader has experienced.
3. **Body** (1000-1300 words) — 3-5 sections with H2 headings. Each section: claim → evidence → so-what.
4. **Take-away** (1 paragraph) — what should the reader do or remember? No empty calls to action.

## Style rules ({{brand_guidelines.tone_of_voice}})

- Sentence-level: 12-22 words average. Vary between short and medium. Avoid 30+ word sentences.
- No words: "comprehensive guide", "ultimate", "everything you need", "in today's", "leverage" (verb), "synergy"
- Cite sources inline as Markdown links.
- Concrete > abstract. Numbers > adjectives.

## Output

Call `submit_deliverable({ type: "blog_post", title: "...", contentMd: "..." })`.
Do NOT call respond_to_lead first — the lead reviews after submission.
