// Claim signer + challenge tickets.
//
// The contract (contracts/RobotHuntCollection.sol) accepts `claim(cardId, proof)`
// where proof is an EIP-191 signature over abi.encodePacked(player, cardId)
// (52 bytes) made by this server's signer key. The game backend only signs
// after the Human Challenge answer is verified server-side.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ethers } from 'ethers';

let wallet: ethers.Wallet | null = null;

export function signer(): ethers.Wallet {
  if (!wallet) {
    const key = process.env.SIGNER_PRIVATE_KEY;
    if (!key) throw new Error('SIGNER_PRIVATE_KEY is not configured');
    wallet = new ethers.Wallet(key);
  }
  return wallet;
}

export function signerAddress(): string {
  return signer().address;
}

function secret(): string {
  return process.env.CHALLENGE_SECRET || process.env.SIGNER_PRIVATE_KEY || '';
}

/** HMAC of the exact player/card/question/answer/expiry tuple. */
export function challengeTicketHash(player: string, cardId: number, questionId: string, answer: string, exp: number): string {
  const payload = JSON.stringify([player.toLowerCase(), cardId, questionId, answer, exp]);
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

export function ticketMatches(h: string, player: string, cardId: number, questionId: string, answer: string, exp: number): boolean {
  const a = Buffer.from(h, 'hex');
  const b = Buffer.from(challengeTicketHash(player, cardId, questionId, answer, exp), 'hex');
  return a.length === b.length && timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
}

export interface ClaimProof {
  r: string;
  s: string;
  v: number;
  signature: string;
}

/** EIP-191 signature over abi.encodePacked(player, cardId) — matches the contract. */
export async function signClaim(player: string, cardId: number): Promise<ClaimProof> {
  const msg = ethers.concat([ethers.getAddress(player), ethers.zeroPadValue(ethers.toBeHex(cardId), 32)]);
  const signature = await signer().signMessage(ethers.getBytes(msg));
  const sig = ethers.Signature.from(signature);
  return { r: sig.r, s: sig.s, v: sig.v, signature };
}
