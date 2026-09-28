# ROBOT HUNT — Collect All 99

A 2D collectible card game for the vibe/vibe ecosystem.
**99 robots. One collection. Prove you're human. Claim your robot.**

Built with React 18 + TypeScript + Vite + Framer Motion + Zustand.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
```

## The three pillars

1. **VibeVibe visual identity** — dark panels, `#5bd08a` green / `#ccff00` lime
   accents, iris violet and amber gold, Clash Display headings, JetBrains Mono
   numerals. Fonts are the site's own self-hosted woff2 files (free licenses),
   and the design tokens mirror `testnet.vibevibe.fun`.
2. **The robot cards** — the real artwork files in `public/robots/` (never
   renamed, never replaced, never duplicated). 26 of them carry the official
   vibe/vibe collection descriptions.
3. **The Human Challenge** — ecosystem knowledge questions (vibe/vibe,
   Robinhood Chain Testnet, $SPARK, the robot collection). Questions live in
   JSON files, separate from the UI.

> **Note on the count:** the `card game/` folder currently contains **98**
> images (27 agents, 6 bureau, 45 bureau roll, 13 vibers, 7 viber extras).
> Every counter in the UI is derived from the dataset, so if the 99th image
> is added, run `npm run cards:gen` and every screen updates automatically —
> no other changes needed.

## Game loop

The home page hosts a **claw machine**: move the claw over a robot, hold to
grab it, carry it (it swings and slips if you jerk the controls) and drop it
into the collection box to claim it. The hunt screen keeps the classic loop:

OPEN PACK → shuffle → CARD FOUND → CARD LOCKED → 30s HUMAN CHECK →
correct: unlock animation + CLAIM (or DUPLICATE → KEEP / BURN → +1 ROBOT SCRAP)
wrong/timeout: THE ROBOT ESCAPED → try again.

- 5 rarities (COMMON / UNCOMMON / RARE / EPIC / LEGENDARY) with matching
  frames, glows and holographic effects.
- Rarity-weighted challenge difficulty: rarer cards ask harder questions.
- Collection screen with ALL / OWNED / MISSING, rarity and series filters.
- Achievements, human streak, scrap resource, mock-wallet mode, leaderboard
  (mock data), full mobile support.

## Project structure

```
public/robots/           the 98 real robot images (originals — card system)
public/robots-cutout/    background-removed, size-normalized versions (home scene)
public/fonts/            self-hosted vibe/vibe fonts
scripts/gen-cards.mjs    regenerates src/data/cards.generated.ts from the images
scripts/remove-bg.swift  Apple Vision background removal + normalization
                         (swift scripts/remove-bg.swift public/robots public/robots-cutout)
scripts/smoke.mjs        e2e smoke test 1 (hunt flow, requires Chrome + dev server)
scripts/smoke2.mjs       e2e smoke test 2 (duplicates, burn, timeout)
src/data/cards.ts        card dataset + selectRandomCard() / selectChallengeFor()
src/data/questions/      question database (JSON, one file per category)
src/game/                store (zustand + localStorage), wallet, sounds, achievements
src/components/          background, robot world, robot card, particles, nav, toasts
src/screens/             home, hunt, collection, profile, leaderboard, how-to-play
```

## Question database

Questions are plain JSON in `src/data/questions/` — update them without
touching the UI. A question is only ever served to players when **all three**
hold: `active: true`, `verified: true`, and `correctAnswer` matches one of
`answers`.

- **25 verified questions** are live, all sourced from the official
  vibe/vibe site (launchpad facts, $SPARK buybacks & burns, collection
  descriptions, socials) and verified 2026-09-28.
- **6 drafts** (the $SPARK/GTD/contract examples) are kept inactive with
  `note` fields describing what still needs verification. Populate and flip
  them to `active` once verified against official sources — never invent
  token amounts, contract digits or PFP details.

Categories: `vibevibe`, `robinhood`, `meta_alchemist`, `meta_alchemist_pfp`,
`x_posts`, `spark`, `gtd`, `nft`, `contract`, `ecosystem`, `current_event`.

## Card data

`src/data/cards.generated.ts` is auto-generated from `public/robots/`:

- Card numbers `001`–`098` are assigned by filename order.
- Series are derived from the filename prefixes (AGENTS, BUREAU, BUREAU ROLL,
  VIBERS, VIBER EXTRAS) — rename series in `scripts/gen-cards.mjs`.
- Rarity is seeded-deterministic; tune the distribution in
  `RARITY_WEIGHTS` inside `scripts/gen-cards.mjs`, then run `npm run cards:gen`.

## Wallet & Robinhood Chain Testnet (game first)

- `src/game/wallet.ts` isolates all wallet logic. The game is fully playable
  offline with a **mock wallet**; a real EIP-1193 wallet can connect on
  **Robinhood Chain Testnet** — the game auto-switches (or auto-adds) the
  network on connect.
- Network params in `src/game/chain.ts` are **verified against the official
  vibe/vibe site bundle** (2026-09-28): chainId `46630`, RPC
  `https://rpc.testnet.chain.robinhood.com`, explorer
  `https://explorer.testnet.chain.robinhood.com`, faucet
  `https://faucet.testnet.chain.robinhood.com`, native ETH.
- `claimCardLocal()` is the seam where the real on-chain claim plugs in.
  The game never invents contract addresses or transaction hashes.

## Deployment

**Live:** <https://robot-hunt-dun.vercel.app> (Vercel project `robot-hunt`,
scope `mazals-projects-1ceb3d60`).

The backend is a set of Vercel serverless functions in `api/` — same repo,
same deploy:

- `api/challenge.ts` — serves a random verified question for the card
  rarity; answers stay server-side (never shipped to the client).
- `api/answer.ts` — checks the answer, then returns an EIP-191 claim proof
  signed by the server signer (`GET /api/signer`).
- `api/health.ts` — status + signer + chain info.
- Offline fallback: if `/api/*` is unreachable the client uses the local
  question pool and labels the check LOCAL (no proof is issued).

Server secrets live only in Vercel (never in the repo):
`SIGNER_PRIVATE_KEY`. Redeploy with `node scripts/run.mjs node
scripts/vercel-deploy.mjs` (reads the git-ignored `.env.deploy`).

### Saving progress on-chain (per wallet address)

**Contract deployed on chain 46630:** `0x8b6f5B47109E41476A48D8Bc902A3A405a99BBAB`
(verified on-chain: code present, `signer()` = the backend signer; the full
proof→claim path passes `eth_call`).

Flow: win challenge → server signs `(player, cardId)` → the player wallet
sends `claim(cardId, proof)` → ownership is recorded per address on
Robinhood Chain Testnet. The UI already drives this automatically once a
real wallet is connected; until then claims stay local and the game says so.

## Validation

- `npm run build` — typecheck + production build.
- `scripts/smoke.mjs` / `scripts/smoke2.mjs` — headless Chrome end-to-end
  tests of the full MVP acceptance flow (31 checks across both, run with the
  dev server up). Requires Google Chrome on macOS.

## Credits

- Artwork: the original 99-robot collection in this repo.
- Design language, fonts and ecosystem facts: vibe/vibe
  (testnet.vibevibe.fun), used as the visual and factual reference.
- Fonts: Clash Display (ITF Free Font License), Instrument Sans and
  JetBrains Mono (OFL).
