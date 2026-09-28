import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ScreenId } from '../data/types';
import { useGame } from '../game/store';
import { connectInjected, connectMock, getWalletChainId, hasInjectedWallet, shortAddress } from '../game/wallet';
import { ROBINHOOD_TESTNET, explorerAddressUrl } from '../game/chain';
import { useToasts } from '../game/toasts';
import { sfx } from '../game/sounds';

const LINKS: { id: ScreenId; label: string; icon: string }[] = [
  { id: 'home', label: 'HOME', icon: '🏠' },
  { id: 'hunt', label: 'HUNT', icon: '🎯' },
  { id: 'collection', label: 'COLLECTION', icon: '🤖' },
  { id: 'profile', label: 'PROFILE', icon: '👤' },
];

interface Props {
  route: ScreenId;
  onNavigate: (s: ScreenId) => void;
}

export default function TopNav({ route, onNavigate }: Props) {
  const [walletOpen, setWalletOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);
  const walletAddress = useGame((s) => s.walletAddress);
  const walletMode = useGame((s) => s.walletMode);
  const muted = useGame((s) => s.muted);
  const toggleMute = useGame((s) => s.toggleMute);
  const setWallet = useGame((s) => s.setWallet);
  const push = useToasts((s) => s.push);

  const onTestnet = chainId === ROBINHOOD_TESTNET.chainId;

  // Keep the chain badge in sync with the wallet.
  useEffect(() => {
    if (walletMode !== 'injected') {
      setChainId(null);
      return;
    }
    let alive = true;
    void getWalletChainId().then((id) => alive && setChainId(id));
    const w = window as unknown as {
      ethereum?: { on?: (e: string, h: (...a: unknown[]) => void) => void; removeListener?: (e: string, h: (...a: unknown[]) => void) => void };
    };
    const onChain = (raw: unknown) => alive && setChainId(parseInt(String(raw), 16) || null);
    w.ethereum?.on?.('chainChanged', onChain);
    return () => {
      alive = false;
      w.ethereum?.removeListener?.('chainChanged', onChain);
    };
  }, [walletMode]);

  const doMock = () => {
    sfx.click();
    const info = connectMock();
    setWallet(info.address, info.mode);
    setWalletOpen(false);
    push('MOCK WALLET CONNECTED', 'info');
  };

  const doInjected = async () => {
    sfx.click();
    setConnecting(true);
    try {
      const outcome = await connectInjected();
      if (outcome.ok) {
        setWallet(outcome.info.address, outcome.info.mode);
        setChainId(ROBINHOOD_TESTNET.chainId);
        setWalletOpen(false);
        push('WALLET CONNECTED · ROBINHOOD TESTNET', 'ok');
      } else if (outcome.reason === 'network-rejected') {
        push('SWITCH TO ROBINHOOD TESTNET WAS REJECTED', 'warn');
      } else if (outcome.reason === 'rejected') {
        push('WALLET REJECTED — TRY AGAIN', 'warn');
      } else {
        push('WALLET UNAVAILABLE', 'warn');
      }
    } catch {
      push('WALLET UNAVAILABLE', 'warn');
    } finally {
      setConnecting(false);
    }
  };

  const doDisconnect = () => {
    sfx.click();
    setWallet(null);
    setWalletOpen(false);
    push('WALLET DISCONNECTED', 'info');
  };

  return (
    <>
      <header className="topnav">
        <a
          className="topnav-brand"
          href="#/home"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('home');
          }}
        >
          <span className="brand-mark">
            <img src="/robots/vibe-vibers-bureau-roll-47-10 (1).png" alt="" />
          </span>
          <span>
            <span className="brand-name">
              ROBOT <span className="amp">HUNT</span>
            </span>
            <br />
            <span className="brand-sub">vibe/vibe · collect</span>
          </span>
        </a>
        <nav className="topnav-links" aria-label="Primary">
          {LINKS.map((l) => (
            <a
              key={l.id}
              href={`#/${l.id}`}
              className={`topnav-pill${route === l.id ? ' active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(l.id);
              }}
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="topnav-spacer" />
        <button className="sound-toggle" onClick={() => toggleMute()} aria-label={muted ? 'Unmute sounds' : 'Mute sounds'} title={muted ? 'Unmute' : 'Mute'}>
          {muted ? '🔇' : '🔊'}
        </button>
        <button
          className="wallet-chip"
          onClick={() => setWalletOpen(true)}
          aria-haspopup="dialog"
          title={walletMode === 'injected' ? ROBINHOOD_TESTNET.name : undefined}
        >
          {walletAddress ? (
            <>
              <span className={`wallet-dot${walletMode === 'mock' || !onTestnet ? ' mock' : ''}`} />
              {shortAddress(walletAddress)}
              {walletMode === 'injected' && <span className="chip-net">⛓</span>}
            </>
          ) : (
            <>
              <span className="wallet-dot mock" />
              CONNECT WALLET
            </>
          )}
        </button>
      </header>

      <AnimatePresence>
        {walletOpen && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setWalletOpen(false)}
          >
            <motion.div
              className="modal"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="Wallet"
            >
              <h3>WALLET</h3>
              {walletAddress ? (
                <>
                  <p>
                    Connected: <strong>{shortAddress(walletAddress)}</strong>
                    <br />
                    {walletMode === 'mock' ? (
                      <span className="mono-label amber">MOCK MODE — LOCAL COLLECTION ONLY</span>
                    ) : (
                      <span className="mono-label green">
                        {onTestnet ? `⛓ ROBINHOOD CHAIN TESTNET · #${ROBINHOOD_TESTNET.chainId}` : '⛓ WRONG NETWORK — RECONNECT TO ROBINHOOD TESTNET'}
                      </span>
                    )}
                  </p>
                  {walletMode === 'injected' && (
                    <a className="btn btn-ghost" href={explorerAddressUrl(walletAddress)} target="_blank" rel="noopener noreferrer">
                      VIEW ON EXPLORER ↗
                    </a>
                  )}
                  <div className="modal-actions">
                    <button className="btn btn-danger" onClick={doDisconnect}>
                      DISCONNECT
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p>
                    The hunt works offline with a mock wallet.
                    <br />
                    A real wallet connects on{' '}
                    <strong>Robinhood Chain Testnet</strong> (#46630). On-chain collection saves land
                    with the contract deploy.
                  </p>
                  <div className="modal-actions">
                    <button className="btn btn-primary" onClick={doMock}>
                      USE MOCK WALLET
                    </button>
                    {hasInjectedWallet() && (
                      <button className="btn" onClick={doInjected} disabled={connecting}>
                        {connecting ? 'SWITCHING NETWORK…' : 'CONNECT ROBINHOOD TESTNET'}
                      </button>
                    )}
                  </div>
                  {hasInjectedWallet() && (
                    <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                      Auto-switches your wallet to chain #{ROBINHOOD_TESTNET.chainId}.
                    </p>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function BottomNav({ route, onNavigate }: Props) {
  return (
    <nav className="bottomnav" aria-label="Primary mobile">
      {LINKS.map((l) => (
        <a
          key={l.id}
          href={`#/${l.id}`}
          className={`bottomnav-item${route === l.id ? ' active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            onNavigate(l.id);
          }}
        >
          <span className="ico" aria-hidden="true">
            {l.icon}
          </span>
          {l.label}
        </a>
      ))}
    </nav>
  );
}
