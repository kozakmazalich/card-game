import { ROBINHOOD_TESTNET, explorerAddressUrl, explorerTxUrl, getInjectedProvider } from './chain';
import type { ClaimProof } from './api';

/**
 * On-chain collection — Robinhood Chain Testnet.
 *
 * The contract (contracts/RobotHuntCollection.sol) compiles cleanly with
 * solc 0.8.20. It is NOT deployed yet: paste the address below once you
 * deploy it (Remix + the funded wallet 0x314e…bcd6d), and the claim/burn
 * paths below activate automatically. Until then every claim stays local
 * and the game never fabricates addresses or hashes.
 */
export const ROBOT_HUNT_CONTRACT = {
  /** Fill in after deployment — never a guessed address. */
  address: null as `0x${string}` | null,
  chainId: ROBINHOOD_TESTNET.chainId,
  chainName: ROBINHOOD_TESTNET.name,
} as const;

// keccak256('claim(uint256,bytes)')[:4] — verified via ethers.
export const CLAIM_SELECTOR = '0x38926b6d';
// keccak256('burn(uint256)')[:4] — verified via ethers.
export const BURN_SELECTOR = '0x42966c68';

export function isContractReady(): boolean {
  return ROBOT_HUNT_CONTRACT.address !== null;
}

export function walletExplorerUrl(address: string): string {
  return explorerAddressUrl(address);
}

function pad32(value: string | number | bigint): string {
  return BigInt(value).toString(16).padStart(64, '0');
}

/** Encodes claim(uint256 cardId, bytes proof) — proof = r(32)‖s(32)‖v(1). */
export function encodeClaimCalldata(cardId: number, proof: ClaimProof): string {
  const bytes = proof.r.slice(2).padStart(64, '0') + proof.s.slice(2).padStart(64, '0') + BigInt(proof.v).toString(16).padStart(2, '0');
  const data = bytes.padEnd(192, '0'); // 65 bytes padded to 3 words
  return `${CLAIM_SELECTOR}${pad32(cardId)}${pad32(0x60)}${pad32(0x41)}${data}`;
}

/** Encodes burn(uint256 cardId). */
export function encodeBurnCalldata(cardId: number): string {
  return `${BURN_SELECTOR}${pad32(cardId)}`;
}

/** Sends the claim transaction from the player's wallet. Returns the tx hash. */
export async function claimOnChain(cardId: number, proof: ClaimProof, from: string): Promise<string> {
  const provider = getInjectedProvider();
  if (!provider) throw new Error('wallet_unavailable');
  if (!ROBOT_HUNT_CONTRACT.address) throw new Error('contract_not_deployed');
  const txHash = (await provider.request({
    method: 'eth_sendTransaction',
    params: [{ from, to: ROBOT_HUNT_CONTRACT.address, data: encodeClaimCalldata(cardId, proof) }],
  })) as string;
  return txHash;
}

/** Sends the burn transaction from the player's wallet. Returns the tx hash. */
export async function burnOnChain(cardId: number, from: string): Promise<string> {
  const provider = getInjectedProvider();
  if (!provider) throw new Error('wallet_unavailable');
  if (!ROBOT_HUNT_CONTRACT.address) throw new Error('contract_not_deployed');
  const txHash = (await provider.request({
    method: 'eth_sendTransaction',
    params: [{ from, to: ROBOT_HUNT_CONTRACT.address, data: encodeBurnCalldata(cardId) }],
  })) as string;
  return txHash;
}

export function claimTxExplorerUrl(hash: string): string {
  return explorerTxUrl(hash);
}
