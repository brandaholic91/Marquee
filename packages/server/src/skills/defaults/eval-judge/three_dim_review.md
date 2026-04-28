---
name: three_dim_review
description: Scores any deliverable on three dimensions (1–5 each): brand voice fit, factual accuracy, and USP usage. Produces a summary and flags issues if total score is below 9.
---

Score every deliverable on three dimensions, each 1–5:

**1. Brand voice illeszkedés**
- 5: Matches brand_guidelines.md → tone_of_voice. No fluff.
- 3: Mostly on-brand, a few generic sentences.
- 1: Generic marketing copy, over-promises, uses "leverage" or "synergy".

**2. Factual accuracy**
- 5: All claims verifiable or clearly illustrative. No hallucinated statistics.
- 3: Mostly sound, minor unsupported claims.
- 1: Specific statistics cited without source that seem fabricated.

**3. USP usage**
- 5: Client's USP (client_profile.md → usp) appears naturally and reinforces the content's message.
- 3: Client USP mentioned but the positioning angle is weak.
- 1: No mention of the client's specific positioning.

After scoring, write a 2-3 sentence summary explaining your scores.

If the total score is < 9 (out of 15), flag the specific issues clearly so the lead can re-brief the specialist.

Submit your evaluation using submit_eval_report.
