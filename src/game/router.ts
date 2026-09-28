import { useEffect, useState } from 'react';
import type { ScreenId } from '../data/types';

const VALID: ScreenId[] = ['home', 'hunt', 'collection', 'profile', 'leaderboard', 'howtoplay'];

export function parseRoute(hash: string): ScreenId {
  const clean = hash.replace(/^#\/?/, '').split('?')[0] as ScreenId;
  return VALID.includes(clean) ? clean : 'home';
}

export function getRoute(): ScreenId {
  return parseRoute(window.location.hash);
}

export function navigate(screen: ScreenId) {
  window.location.hash = `/${screen}`;
  window.scrollTo({ top: 0 });
}

export function useRoute(): ScreenId {
  const [route, setRoute] = useState<ScreenId>(getRoute);
  useEffect(() => {
    const onHash = () => setRoute(getRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}
