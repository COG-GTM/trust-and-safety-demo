import { v4 as uuidv4 } from 'uuid';
import create from 'zustand';

import {
  DEFAULT_WIDGET_LAYOUTS,
  Dashboard,
  DashboardLayout,
  DashboardWidget,
  WidgetType,
} from '../types/DashboardTypes';

const EMPTY_LAYOUT: DashboardLayout = { widgets: [], rgl: [] };

export interface DashboardStore {
  dashboards: Dashboard[];
  currentDashboard: Dashboard | null;
  draftLayout: DashboardLayout;
  isDirty: boolean;

  setDashboards: (dashboards: Dashboard[]) => void;
  setCurrentDashboard: (dashboard: Dashboard | null) => void;
  resetDraft: () => void;
  applyDraftLayout: (layout: DashboardLayout) => void;
  addWidget: (type: WidgetType, config?: Record<string, unknown>) => DashboardWidget;
  removeWidget: (id: string) => void;
  updateWidget: (id: string, config: Record<string, unknown>) => void;
  updateRglLayout: (rgl: DashboardLayout['rgl']) => void;
  markClean: () => void;
}

function nextStackPosition(rgl: DashboardLayout['rgl']): { x: number; y: number } {
  if (rgl.length === 0) return { x: 0, y: 0 };
  const maxY = rgl.reduce((acc, item) => Math.max(acc, item.y + item.h), 0);
  return { x: 0, y: maxY };
}

const useDashboardStore = create<DashboardStore>((set, get) => ({
  dashboards: [],
  currentDashboard: null,
  draftLayout: EMPTY_LAYOUT,
  isDirty: false,

  setDashboards: (dashboards) => set({ dashboards }),

  setCurrentDashboard: (dashboard) => {
    if (dashboard == null) {
      set({ currentDashboard: null, draftLayout: EMPTY_LAYOUT, isDirty: false });
      return;
    }
    set({
      currentDashboard: dashboard,
      draftLayout: dashboard.layout_json ?? EMPTY_LAYOUT,
      isDirty: false,
    });
  },

  resetDraft: () => {
    const current = get().currentDashboard;
    set({ draftLayout: current?.layout_json ?? EMPTY_LAYOUT, isDirty: false });
  },

  applyDraftLayout: (layout) => set({ draftLayout: layout, isDirty: true }),

  addWidget: (type, config = {}) => {
    const id = uuidv4();
    const sizing = DEFAULT_WIDGET_LAYOUTS[type];
    const widget: DashboardWidget = { id, type, config: { ...config } };
    set((state) => {
      const stack = nextStackPosition(state.draftLayout.rgl);
      const rglItem = {
        i: id,
        x: stack.x,
        y: stack.y,
        w: sizing.w,
        h: sizing.h,
        minW: sizing.minW,
        minH: sizing.minH,
      };
      return {
        draftLayout: {
          widgets: [...state.draftLayout.widgets, widget],
          rgl: [...state.draftLayout.rgl, rglItem],
        },
        isDirty: true,
      };
    });
    return widget;
  },

  removeWidget: (id) =>
    set((state) => ({
      draftLayout: {
        widgets: state.draftLayout.widgets.filter((w) => w.id !== id),
        rgl: state.draftLayout.rgl.filter((item) => item.i !== id),
      },
      isDirty: true,
    })),

  updateWidget: (id, config) =>
    set((state) => ({
      draftLayout: {
        ...state.draftLayout,
        widgets: state.draftLayout.widgets.map((w) => (w.id === id ? { ...w, config: { ...w.config, ...config } } : w)),
      },
      isDirty: true,
    })),

  updateRglLayout: (rgl) =>
    set((state) => {
      let changed = false;
      const merged = state.draftLayout.rgl.map((existing) => {
        const updated = rgl.find((item) => item.i === existing.i);
        if (updated == null) return existing;
        if (
          existing.x !== updated.x ||
          existing.y !== updated.y ||
          existing.w !== updated.w ||
          existing.h !== updated.h
        ) {
          changed = true;
        }
        return { ...existing, ...updated };
      });
      if (!changed) return state;
      return { ...state, draftLayout: { ...state.draftLayout, rgl: merged }, isDirty: true };
    }),

  markClean: () => set({ isDirty: false }),
}));

export default useDashboardStore;
