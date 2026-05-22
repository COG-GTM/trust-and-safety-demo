import create from 'zustand';

import { AutoRefreshIntervals } from '../Constants';

type AutoRefreshInterval = (typeof AutoRefreshIntervals)[keyof typeof AutoRefreshIntervals];

interface AutoRefreshStore {
  intervalMs: AutoRefreshInterval;
  // Monotonically-increasing counter, bumped each time a refresh "tick" fires.
  // Components subscribe to this to re-fetch their data without owning the
  // timer themselves.
  tick: number;
  setIntervalMs: (intervalMs: AutoRefreshInterval) => void;
  bumpTick: () => void;
}

const useAutoRefreshStore = create<AutoRefreshStore>((set) => ({
  intervalMs: AutoRefreshIntervals.OFF,
  tick: 0,
  setIntervalMs: (intervalMs) => set({ intervalMs }),
  bumpTick: () => set((state) => ({ tick: state.tick + 1 })),
}));

export default useAutoRefreshStore;
