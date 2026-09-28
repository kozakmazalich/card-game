import type { RobotCard } from '../data/types';
import { ensureRobinhoodTestnet, getConnectedChainId, getInjectedProvider, requestAccounts } from './chain';

/**
 * Wallet abstraction.
 *
 * The game works fully offline with a MOCK wallet. A real EIP-1193 wallet can
 * connect on Robinhood Chain Testnet (chainId 46630) — the wallet is
 * auto-switched to that network on connect. The game itself never mints or
 * sends transactions yet: `claimCardLocal` is the seam where the on-chain
 * claim (see `contract.ts`) plugs in. No contract addresses and no
 * transaction hashes are fabricated.
 */

export type WalletMode = 'mock' | 'injected' | null;

export interface WalletInfo {
  address: string;
  mode: Exclude<WalletMode, null>;
}

export type ConnectOutcome =
  | { ok: true; info: WalletInfo }
  | { ok: false; reason: 'rejected' | 'unavailable' | 'network-rejected' };

function randomAddress(): string {
  const hex = '0123456789abcdef';
  let out = '0x';
  for (let i = 0; i < 40; i++) out += hex[Math.floor(Math.random() * 16)];
  return out;
}

export function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function connectMock(): WalletInfo {
  return { address: randomAddress(), mode: 'mock' };
}

export function hasInjectedWallet(): boolean {
  return Boolean(getInjectedProvider());
}

/**
 * Connects the injected wallet and makes sure it is on Robinhood Chain
 * Testnet before returning the account.
 */
export async function connectInjected(): Promise<ConnectOutcome> {
  const provider = getInjectedProvider();
  if (!provider) return { ok: false, reason: 'unavailable' };

  const ensured = await ensureRobinhoodTestnet(provider);
  if (!ensured.ok) {
    return ensured.reason === 'rejected' ? { ok: false, reason: 'network-rejected' } : { ok: false, reason: 'unavailable' };
  }

  try {
    const accounts = await requestAccounts(provider);
    if (!accounts[0]) return { ok: false, reason: 'unavailable' };
    return { ok: true, info: { address: accounts[0], mode: 'injected' } };
  } catch {
    return { ok: false, reason: 'rejected' };
  }
}

/** Current wallet chain id (null when no injected provider). */
export async function getWalletChainId(): Promise<number | null> {
  const provider = getInjectedProvider();
  if (!provider) return null;
  return getConnectedChainId(provider);
}

export interface LocalClaimReceipt {
  status: 'local';
  cardId: string;
  address: string;
  claimedAt: number;
  note: 'Local-only claim. The on-chain claim call plugs in here later.';
}

/** Local, off-chain claim. Blockchain logic stays out of the game UI. */
export function claimCardLocal(card: RobotCard, address: string): LocalClaimReceipt {
  return {
    status: 'local',
    cardId: card.id,
    address,
    claimedAt: Date.now(),
    note: 'Local-only claim. The on-chain claim call plugs in here later.',
  };
}

// Future service signatures (see src/game/contract.ts):
//   getOwnedCardsOnChain(address)  -> cardIds (view call on Robinhood Testnet)
//   claimCardOnChain(address, cardId, proof) -> tx hash
