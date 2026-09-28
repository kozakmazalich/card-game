import type { VercelRequest, VercelResponse } from '@vercel/node';
import { signerAddress } from './_lib/keys.js';

/** Public key of the claim signer — pass this to the contract constructor. */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ address: signerAddress() });
}
