import type { VercelRequest, VercelResponse } from '@vercel/node';
import { signerAddress } from './_lib/keys.js';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: true,
    game: 'robot-hunt',
    chain: { name: 'Robinhood Chain Testnet', chainId: 46630 },
    signer: signerAddress(),
    contract: '0x8b6f5B47109E41476A48D8Bc902A3A405a99BBAB',
  });
}
