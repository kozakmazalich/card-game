import { TOTAL_CARDS } from '../data/cards';
import { useGame } from '../game/store';
import { sfx } from '../game/sounds';
import { navigate } from '../game/router';
import CountUp from '../components/CountUp';
import RobotWorld from '../components/RobotWorld';

export default function Home() {
  const owned = useGame((s) => s.owned);
  const streak = useGame((s) => s.streak);
  const bestStreak = useGame((s) => s.bestStreak);
  const scrap = useGame((s) => s.scrap);
  const cardsClaimed = useGame((s) => s.cardsClaimed);

  const unique = Object.keys(owned).length;

  const go = (s: Parameters<typeof navigate>[0]) => {
    sfx.click();
    navigate(s);
  };

  return (
    <div className="home">
      <section className="hero">
        <span className="hero-kicker">PROVE YOU'RE HUMAN · CLAIM YOUR ROBOT</span>
        <h1 className="hero-title display">
          ROBOT <span className="outline">HUNT</span>
        </h1>
        <p className="hero-sub">
          <span className="num">{TOTAL_CARDS}</span> ROBOTS. ONE COLLECTION.
        </p>
        <p className="hero-tag">vibe/vibe · ROBINHOOD CHAIN TESTNET</p>

        <div className="hero-progress">
          <strong>
            <CountUp value={unique} />
          </strong>
          <span className="sep">/</span>
          <span>{TOTAL_CARDS} ROBOTS</span>
        </div>

        <div className="hero-actions">
          <button className="btn btn-primary btn-big" onClick={() => go('hunt')}>
            🎯 START HUNT
          </button>
          <button className="btn btn-big" onClick={() => go('collection')}>
            MY COLLECTION
          </button>
          <button className="btn btn-ghost btn-big" onClick={() => go('howtoplay')}>
            HOW TO PLAY
          </button>
        </div>

        <RobotWorld />
      </section>

      <section className="stat-strip" aria-label="Your stats">
        <div className="stat-tile">
          <div className="k">COLLECTION</div>
          <div className="v green">
            <CountUp value={unique} />/{TOTAL_CARDS}
          </div>
        </div>
        <div className="stat-tile">
          <div className="k">HUMAN STREAK</div>
          <div className="v amber">🔥 {streak}</div>
        </div>
        <div className="stat-tile">
          <div className="k">BEST STREAK</div>
          <div className="v">{bestStreak}</div>
        </div>
        <div className="stat-tile">
          <div className="k">ROBOT SCRAP</div>
          <div className="v iris">{scrap}</div>
        </div>
        <div className="stat-tile">
          <div className="k">CARDS CLAIMED</div>
          <div className="v lime">{cardsClaimed}</div>
        </div>
      </section>

      <section className="home-panels">
        <div className="mini-panel panel">
          <h3>THE HUNT</h3>
          <p>Open a pack. Get a locked robot. Answer an ecosystem question in 30 seconds. Claim it. Collect them all.</p>
          <button className="btn btn-primary" onClick={() => go('hunt')}>
            START HUNTING
          </button>
        </div>
        <div className="mini-panel panel">
          <h3>HUMAN CHECK</h3>
          <p>
            Questions come from the real vibe/vibe world — $SPARK, the launchpad, the robots themselves. Pay attention or the robot escapes.
          </p>
          <button className="btn btn-ghost" onClick={() => go('leaderboard')}>
            VIEW LEADERBOARD
          </button>
        </div>
      </section>
    </div>
  );
}
