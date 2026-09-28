import type { VercelRequest, VercelResponse } from '@vercel/node';
import { findQuestion } from './_lib/pool.js';
import { signClaim, ticketMatches } from './_lib/keys.js';
import { allow } from './_lib/rate.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown');
  if (!allow(ip)) {
    return res.status(429).json({ error: 'rate_limited', retryAfterMs: 60_000 });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const ticket = (body.ticket ?? {}) as { h?: string; exp?: number; qid?: string; player?: string; cardId?: number };
  const answer = String(body.answer ?? '');

  if (!ticket.h || !ticket.qid || !ticket.player || typeof ticket.exp !== 'number' || typeof ticket.cardId !== 'number') {
    return res.status(400).json({ error: 'bad_ticket' });
  }

  const question = findQuestion(ticket.qid);
  if (!question) {
    return res.status(400).json({ error: 'unknown_question' });
  }

  if (Date.now() > ticket.exp) {
    return res.status(200).json({ correct: false, correctAnswer: question.correctAnswer, expired: true });
  }

  const correct = ticketMatches(ticket.h, ticket.player, ticket.cardId, ticket.qid, answer, ticket.exp);
  if (!correct) {
    return res.status(200).json({ correct: false, correctAnswer: question.correctAnswer });
  }

  // Verified human → sign the claim proof for (player, cardId).
  const proof = await signClaim(ticket.player, ticket.cardId);
  return res.status(200).json({ correct: true, proof });
}
