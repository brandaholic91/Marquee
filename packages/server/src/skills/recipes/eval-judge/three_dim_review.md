---
name: three_dim_review
when_to_use: A new deliverable revision is awaiting_eval
input_schema:
  deliverableId: string
  revisionId: string
output: a submit_eval_report tool call with 3 scores and a summary
---

# Eval rubric

Read the deliverable via `read_deliverable(deliverableId)`. Read {{client_profile.client_name}} memory ({{brand_guidelines}}).

Score each dimension 1-5:

## brand_voice (1-5)
- 5: Indistinguishable from {{brand_guidelines.reference_examples}}
- 3: Mostly on-brand, 1-2 voice slips
- 1: Generic SaaS marketing copy

## factual_accuracy (1-5)
- 5: Every claim is specific and verifiable; sources cited where appropriate
- 3: Claims are reasonable but unsupported
- 1: Contains demonstrably false or unverifiable statements

## usp_usage (1-5)
- 5: USP "{{client_profile.usp}}" is naturally woven in and reinforced
- 3: USP mentioned once, not central
- 1: USP absent or contradicted

## Output

`submit_eval_report({ deliverableRevisionId, scores: {...}, summary })`.

Summary format: 2-3 sentences. Lead with the lowest-scoring dimension and one specific example. Do not gloss.

This is **advisory** — your score does not block approval. The human decides.
