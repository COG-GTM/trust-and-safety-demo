import create from 'zustand';

import { DashboardWindow, DashboardGranularity, EntityType } from '../api/dashboard';

interface DashboardState {
  window: DashboardWindow;
  granularity: DashboardGranularity;
  entityType: EntityType;
  autoRefresh: boolean;
  refreshIntervalMs: number;
  setWindow: (window: DashboardWindow) => void;
  setGranularity: (granularity: DashboardGranularity) => void;
  setEntityType: (entityType: EntityType) => void;
  setAutoRefresh: (autoRefresh: boolean) => void;
  setRefreshIntervalMs: (refreshIntervalMs: number) => void;
}

const useDashboardStore = create<DashboardState>((set) => ({
  window: '24h',
  granularity: 'hour',
  entityType: 'User',
  autoRefresh: true,
  refreshIntervalMs: 60_000,
  setWindow: (window) => set({ window }),
  setGranularity: (granularity) => set({ granularity }),
  setEntityType: (entityType) => set({ entityType }),
  setAutoRefresh: (autoRefresh) => set({ autoRefresh }),
  setRefreshIntervalMs: (refreshIntervalMs) => set({ refreshIntervalMs }),
}));

export default useDashboardStore;
