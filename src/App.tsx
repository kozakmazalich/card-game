import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRoute, navigate } from './game/router';
import { useGame } from './game/store';
import Background from './components/Background';
import TopNav, { BottomNav } from './components/Nav';
import Toasts from './components/Toasts';
import Home from './screens/Home';
import Hunt from './screens/Hunt';
import Collection from './screens/Collection';
import Profile from './screens/Profile';
import Leaderboard from './screens/Leaderboard';
import HowToPlay from './screens/HowToPlay';

const SCREENS = {
  home: Home,
  hunt: Hunt,
  collection: Collection,
  profile: Profile,
  leaderboard: Leaderboard,
  howtoplay: HowToPlay,
};

export default function App() {
  const route = useRoute();
  const markSeen = useGame((s) => s.markSeen);

  useEffect(() => {
    markSeen();
  }, [markSeen]);

  const Screen = SCREENS[route];

  return (
    <div className="app">
      <Background />
      <TopNav route={route} onNavigate={navigate} />
      <main className="app-main">
        <AnimatePresence mode="wait">
          <motion.div
            key={route}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <Screen />
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav route={route} onNavigate={navigate} />
      <Toasts />
    </div>
  );
}
