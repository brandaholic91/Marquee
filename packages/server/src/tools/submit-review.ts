import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createId } from '@paralleldrive/cuid2';
import { deliverableReviews } from '../db/schema.js';

type Db = ReturnType<typeof drizzle>;
interface Broker { emit: (e: Record<string, unknown>) => void; }

export interface SubmitReviewContext {
  db: Db;
  broker: Broker;
  deliverableId: string;
}

export interface ReviewComment {
  quote: string;
  issue: string;
  severity: 'info' | 'warn' | 'error';
}

export interface ReviewSuggestion {
  original: string;
  suggested: string;
  reasoning: string;
}

export interface SubmitReviewInput {
  score: number;
  comments: ReviewComment[];
  suggestions: ReviewSuggestion[];
  summary: string;
}

export function makeSubmitReviewTool(ctx: SubmitReviewContext) {
  return {
    name: 'submit_review',
    description: 'Add be a brand voice review-t. A deliverable szövegét átnézted, most küldd be a strukturált visszajelzést score-ral, megjegyzésekkel és javaslatokkal.',
    inputSchema: {
      type: 'object',
      properties: {
        score: {
          type: 'number',
          description: '1-10 közötti pontszám. 1-3: jelentős eltérés. 4-6: részleges eltérés. 7-8: kisebb finomítások. 9-10: brand voice OK.',
        },
        comments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              quote: { type: 'string', description: 'Az érintett mondat/kifejezés a deliverable szövegéből.' },
              issue: { type: 'string', description: 'Mi a probléma röviden.' },
              severity: { type: 'string', enum: ['info', 'warn', 'error'] },
            },
            required: ['quote', 'issue', 'severity'],
          },
        },
        suggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              original: { type: 'string' },
              suggested: { type: 'string' },
              reasoning: { type: 'string' },
            },
            required: ['original', 'suggested', 'reasoning'],
          },
        },
        summary: {
          type: 'string',
          description: '1-2 mondatos összefoglaló a review eredményéről.',
        },
      },
      required: ['score', 'comments', 'suggestions', 'summary'],
    },
    execute: async (input: SubmitReviewInput) => {
      const id = createId();
      await ctx.db.insert(deliverableReviews).values({
        id,
        deliverableId: ctx.deliverableId,
        reviewerRole: 'brand_voice_guardian',
        score: input.score,
        comments: JSON.stringify(input.comments),
        suggestions: JSON.stringify(input.suggestions),
        summary: input.summary,
        createdAt: Date.now(),
      });
      ctx.broker.emit({ type: 'review_completed', review_id: id, deliverable_id: ctx.deliverableId });
      return { review_id: id };
    },
  };
}
