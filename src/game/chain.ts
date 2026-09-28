/**
 * Robinhood Chain Testnet — network parameters.
 *
 * VERIFIED against the official vibe/vibe site bundle (Token-e8QC1pWu.js,
 * liveWalletProvider-CL_TPIHi.js, deployment-CAoG4IZP.js), 2026-09-28:
 *   chainId 46630 · name "Robinhood Chain Testnet" · native Ether/ETH/18
 *   rpc https://rpc.testnet.chain.robinhood.com
 *   explorer https://explorer.testnet.chain.robinhood.com
 *   faucet https://faucet.testnet.chain.robinhood.com
 */
export const ROBINHOOD_TESTNET = {
  chainId: 46630,
  get chainIdHex() {
    return `0x${this.chainId.toString(16)}`;
  },
  name: 'Robinhood Chain Testnet',
  shortName: 'ROBINHOOD TESTNET',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://rpc.testnet.chain.robinhood.com'],
  blockExplorerUrl: 'https://explorer.testnet.chain.robinhood.com',
  faucetUrl: 'https://faucet.testnet.chain.robinhood.com',
} as const;

/** Minimal EIP-1193 (+ EIP-3085/3326) provider surface we rely on. */
export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

export function getInjectedProvider(): Eip1193Provider | null {
  const w = window as unknown as { ethereum?: Eip1193Provider };
  return w.ethereum?.request ? w.ethereum : null;
}

export type EnsureResult =
  | { ok: true }
  | { ok: false; reason: 'rejected' | 'unavailable' };

/** Switches the wallet to Robinhood Chain Testnet, adding it if needed. */
export async function ensureRobinhoodTestnet(p: Eip1193Provider): Promise<EnsureResult> {
  try {
    const current = (await p.request({ method: 'eth_chainId' })) as string;
    if (String(current).toLowerCase() === ROBINHOOD_TESTNET.chainIdHex) return { ok: true };

    try {
      await p.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ROBINHOOD_TESTNET.chainIdHex }],
      });
      return { ok: true };
    } catch (err) {
      // 4902 = chain not added to the wallet yet → add it.
      if ((err as { code?: number }).code === 4902) {
        await p.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: ROBINHOOD_TESTNET.chainIdHex,
              chainName: ROBINHOOD_TESTNET.name,
              nativeCurrency: ROBINHOOD_TESTNET.nativeCurrency,
              rpcUrls: [...ROBINHOOD_TESTNET.rpcUrls],
              blockExplorerUrls: [ROBINHOOD_TESTNET.blockExplorerUrl],
            },
          ],
        });
        return { ok: true };
      }
      throw err;
    }
  } catch (err) {
    if ((err as { code?: number }).code === 4001) return { ok: false, reason: 'rejected' };
    return { ok: false, reason: 'unavailable' };
  }
}

export async function getConnectedChainId(p: Eip1193Provider): Promise<number | null> {
  try {
    const raw = (await p.request({ method: 'eth_chainId' })) as string;
    return parseInt(raw, 16);
  } catch {
    return null;
  }
}

export async function requestAccounts(p: Eip1193Provider): Promise<string[]> {
  return (await p.request({ method: 'eth_requestAccounts' })) as string[];
}

export async function getAccounts(p: Eip1193Provider): Promise<string[]> {
  return (await p.request({ method: 'eth_accounts' })) as string[];
}

export function explorerAddressUrl(address: string): string {
  return `${ROBINHOOD_TESTNET.blockExplorerUrl}/address/${address}`;
}

export function explorerTxUrl(hash: string): string {
  return `${ROBINHOOD_TESTNET.blockExplorerUrl}/tx/${hash}`;
}
