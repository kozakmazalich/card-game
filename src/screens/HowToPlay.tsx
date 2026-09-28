import { TOTAL_CARDS } from '../data/cards';
import { QUESTION_STATS } from '../data/questions';
import { navigate } from '../game/router';
import { sfx } from '../game/sounds';

const STEPS = [
  { t: 'OPEN A PACK', d: 'Hit START HUNT. A random robot is selected — you never know which one is coming.' },
  { t: 'CARD LOCKED', d: `The robot appears locked. You have 30 seconds to prove you're human.` },
  { t: 'HUMAN CHECK', d: 'Answer an ecosystem question about vibe/vibe, Robinhood Chain, $SPARK or the robots themselves.' },
  { t: 'CLAIM YOUR ROBOT', d: 'Answer right and the lock breaks. The robot joins your collection. Wrong — it escapes.' },
  { t: 'COLLECT THEM ALL', d: `Find all ${TOTAL_CARDS} robots across every rarity. Duplicates can be kept or burned for scrap.` },
];

export default function HowToPlay() {
  return (
    <div className="htp">
      <h1 className="collection-title">HOW TO PLAY</h1>
      <p style={{ margin: 0, color: 'var(--body)' }}>
        Robot Hunt is a collectible card game. The robots are the collectibles — the human challenge is how you claim them.
      </p>

      {STEPS.map((s, i) => (
        <div key={s.t} className="panel htp-step">
          <span className="htp-num">0{i + 1}</span>
          <div>
            <h3>{s.t}</h3>
            <p>{s.d}</p>
          </div>
        </div>
      ))}

      <div className="htp-loop" role="img" aria-label="Game loop diagram">
        OPEN GAME
        <br />
        <span className="ar">↓</span> GET RANDOM CARD
        <br />
        <span className="ar">↓</span> CARD LOCKED
        <br />
        <span className="ar">↓</span> HUMAN CHALLENGE
        <br />
        <span className="ar">↓</span> CARD UNLOCKS
        <br />
        <span className="ar">↓</span> COLLECTION +1
        <br />
        <span className="ar">↓</span> TRY AGAIN — COLLECT ALL {TOTAL_CARDS}
      </div>

      <div className="panel htp-step">
        <span className="htp-num" aria-hidden="true">
          ⚡
        </span>
        <div>
          <h3>WHAT KIND OF QUESTIONS?</h3>
          <p>
            Real ecosystem knowledge: the vibe/vibe launchpad, Robinhood Chain Testnet, $SPARK buybacks & burns, and tiny details of the robot collection itself. No
            generic trivia. {QUESTION_STATS.active} verified questions are live, sourced from the official site.
          </p>
        </div>
      </div>

      <button
        className="btn btn-primary btn-big"
        style={{ alignSelf: 'center', marginTop: 6 }}
        onClick={() => {
          sfx.click();
          navigate('hunt');
        }}
      >
        🎯 START HUNT
      </button>
    </div>
  );
}
