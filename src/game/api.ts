import type { QuestionDifficulty, QuestionCategory, Rarity } from '../data/types';
import { pickQuestion, shuffleAnswers } from '../data/questions';

/**
 * Client for the serverless Human Challenge API (Vercel /api/*).
 *
 * Same-origin, no config needed. If the API is unreachable (e.g. local dev,
 * offline), the game degrades gracefully to the client-side pool and labels
 * the check LOCAL — the on-chain claim proof is only ever issued by the
 * server.
 */

export interface ServerTicket {
  h: string;
  exp: number;
  qid: string;
  player: string;
  cardId: number;
}

export interface ChallengePayload {
  mode: 'server' | 'local';
  ticket?: ServerTicket;
  expiresAt?: number;
  question: {
    id: string;
    text: string;
    category: QuestionCategory;
    difficulty: QuestionDifficulty;
    source: string;
  };
  answers: string[];
  /** local mode only — never leaves the client */
  localCorrect?: string;
}

export interface ClaimProof {
  r: string;
  s: string;
  v: number;
  signature: string;
}

export interface AnswerPayload {
  correct: boolean;
  correctAnswer?: string;
  expired?: boolean;
  proof?: ClaimProof;
}

export async function fetchChallenge(opts: {
  cardId: number;
  rarity: Rarity;
  player: string;
  excludeIds: string[];
}): Promise<ChallengePayload> {
  try {
    const res = await fetch('/api/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    });
    const ct = res.headers.get('content-type') ?? '';
    if (res.ok && ct.includes('application/json')) {
      const data = (await res.json()) as Record<string, unknown>;
      const q = data.question as ChallengePayload['question'];
      if (data.mode === 'server' && q?.text && Array.isArray(data.answers)) {
        return {
          mode: 'server',
          ticket: data.ticket as ServerTicket,
          expiresAt: data.expiresAt as number,
          question: q,
          answers: data.answers as string[],
        };
      }
    }
    throw new Error('api unavailable');
  } catch {
    const q = pickQuestion(opts.rarity, opts.excludeIds);
    if (!q) throw new Error('no questions available');
    return {
      mode: 'local',
      question: {
        id: q.id,
        text: q.question,
        category: q.category,
        difficulty: q.difficulty,
        source: q.source,
      },
      answers: shuffleAnswers(q),
      localCorrect: q.correctAnswer,
    };
  }
}

export async function submitAnswer(challenge: ChallengePayload, answer: string): Promise<AnswerPayload> {
  if (challenge.mode === 'local') {
    const correct = answer === challenge.localCorrect;
    return correct ? { correct: true } : { correct: false, correctAnswer: challenge.localCorrect };
  }
  try {
    const res = await fetch('/api/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket: challenge.ticket, answer }),
    });
    if (!res.ok) throw new Error('api error');
    return (await res.json()) as AnswerPayload;
  } catch {
    // Server unreachable mid-challenge → conservative local judgment.
    return { correct: false, correctAnswer: undefined };
  }
}
