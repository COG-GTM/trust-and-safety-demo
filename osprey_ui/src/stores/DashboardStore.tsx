import create from 'zustand';

import {
  DashboardLayoutJson,
  DashboardRecord,
  DashboardSummary,
  DashboardTimeRange,
  DashboardWidget,
} from '../types/DashboardTypes';

export const DEFAULT_TIME_RANGE: DashboardTimeRange = { interval: '24h' };

export const DEFAULT_LAYOUT: DashboardLayoutJson = {
  version: 1,
  widgets: [],
  defaultTimeRange: DEFAULT_TIME_RANGE,
  globalQueryFilter: '',
  refreshIntervalSeconds: 0,
  gridColumns: 12,
};

export interface DashboardStore {
  /** Dashboards visible in the switcher / list view. */
  dashboards: DashboardSummary[];
  setDashboards: (dashboards: DashboardSummary[]) => void;

  /** Currently-loaded dashboard (full record incl. layout). */
  current: DashboardRecord | null;
  setCurrent: (dashboard: DashboardRecord | null) => void;

  /** Whether the user is editing the layout (drag/resize/add/remove). */
  editMode: boolean;
  setEditMode: (editMode: boolean) => void;

  /** Currently-selected widget for editing in the side panel/modal. */
  selectedWidgetId: string | null;
  setSelectedWidgetId: (widgetId: string | null) => void;

  /** Local layout buffer used while editing. */
  draftLayout: DashboardLayoutJson | null;
  setDraftLayout: (layout: DashboardLayoutJson | null) => void;
  updateDraftWidget: (widget: DashboardWidget) => void;
  removeDraftWidget: (widgetId: string) => void;
  addDraftWidget: (widget: DashboardWidget) => void;
  setDraftGlobalTimeRange: (timeRange: DashboardTimeRange) => void;
  setDraftGlobalQueryFilter: (queryFilter: string) => void;
  setDraftRefreshIntervalSeconds: (seconds: number) => void;
}

const useDashboardStore = create<DashboardStore>((set, get) => ({
  dashboards: [],
  setDashboards: (dashboards) => set({ dashboards }),

  current: null,
  setCurrent: (current) => set({ current, draftLayout: current ? cloneLayout(current.layout_json) : null }),

  editMode: false,
  setEditMode: (editMode) => {
    const { current } = get();
    set({
      editMode,
      // When leaving edit mode without saving, dump the draft so it doesn't
      // leak into the next session.
      draftLayout: editMode && current ? cloneLayout(current.layout_json) : null,
      selectedWidgetId: editMode ? get().selectedWidgetId : null,
    });
  },

  selectedWidgetId: null,
  setSelectedWidgetId: (selectedWidgetId) => set({ selectedWidgetId }),

  draftLayout: null,
  setDraftLayout: (draftLayout) => set({ draftLayout }),

  updateDraftWidget: (widget) =>
    set((state) => {
      if (state.draftLayout == null) return state;
      const widgets = state.draftLayout.widgets.map((w) => (w.id === widget.id ? widget : w));
      return { draftLayout: { ...state.draftLayout, widgets } };
    }),

  removeDraftWidget: (widgetId) =>
    set((state) => {
      if (state.draftLayout == null) return state;
      return {
        draftLayout: {
          ...state.draftLayout,
          widgets: state.draftLayout.widgets.filter((w) => w.id !== widgetId),
        },
        selectedWidgetId: state.selectedWidgetId === widgetId ? null : state.selectedWidgetId,
      };
    }),

  addDraftWidget: (widget) =>
    set((state) => {
      if (state.draftLayout == null) return state;
      return {
        draftLayout: {
          ...state.draftLayout,
          widgets: [...state.draftLayout.widgets, widget],
        },
      };
    }),

  setDraftGlobalTimeRange: (timeRange) =>
    set((state) => {
      if (state.draftLayout == null) return state;
      return { draftLayout: { ...state.draftLayout, defaultTimeRange: timeRange } };
    }),

  setDraftGlobalQueryFilter: (queryFilter) =>
    set((state) => {
      if (state.draftLayout == null) return state;
      return { draftLayout: { ...state.draftLayout, globalQueryFilter: queryFilter } };
    }),

  setDraftRefreshIntervalSeconds: (seconds) =>
    set((state) => {
      if (state.draftLayout == null) return state;
      return { draftLayout: { ...state.draftLayout, refreshIntervalSeconds: seconds } };
    }),
}));

function cloneLayout(layout: DashboardLayoutJson): DashboardLayoutJson {
  return {
    ...layout,
    widgets: layout.widgets.map((w) => ({ ...w, layout: { ...w.layout }, dataSource: { ...w.dataSource } })),
    defaultTimeRange: layout.defaultTimeRange ? { ...layout.defaultTimeRange } : undefined,
  };
}

export default useDashboardStore;
