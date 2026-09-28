import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pickQuestion, shuffleAnswers } from './_lib/pool.js';
import { challengeTicketHash } from './_lib/keys.js';
import { allow } from './_lib/rate.js';

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const CHALLENGE_TTL_MS = 45_000; // game timer is 30s; small buffer for latency

function isAddress(s: unknown): s is string {
  return typeof s === 'string' && /^0x[a-fA-F0-9]{40}$/.test(s);
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown');
  if (!allow(ip)) {
    return res.status(429).json({ error: 'rate_limited', retryAfterMs: 60_000 });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const rarity = String(body.rarity ?? '');
  const cardId = Number(body.cardId);
  const player = isAddress(body.player) ? body.player : '0x0000000000000000000000000000000000000000';
  const excludeIds = Array.isArray(body.excludeIds) ? (body.excludeIds as string[]).slice(0, 50) : [];

  if (!RARITIES.includes(rarity) || !Number.isInteger(cardId) || cardId < 1 || cardId > 98) {
    return res.status(400).json({ error: 'bad_request' });
  }

  const question = pickQuestion(rarity, excludeIds);
  if (!question) {
    return res.status(404).json({ error: 'no_question' });
  }

  const exp = Date.now() + CHALLENGE_TTL_MS;
  const ticket = {
    h: challengeTicketHash(player, cardId, question.id, question.correctAnswer, exp),
    exp,
    qid: question.id,
    player,
    cardId,
  };

  return res.status(200).json({
    mode: 'server',
    ticket,
    expiresAt: exp,
    question: {
      id: question.id,
      text: question.question,
      category: question.category,
      difficulty: question.difficulty,
      source: question.source,
    },
    answers: shuffleAnswers(question),
  });
}
