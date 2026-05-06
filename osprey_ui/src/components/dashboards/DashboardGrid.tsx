import * as React from 'react';

import { DashboardLayoutJson, DashboardWidget, DashboardWidgetLayout } from '../../types/DashboardTypes';
import DashboardWidgetFrame from './DashboardWidgetFrame';
import { renderWidget } from './widgets/registry';
import { WidgetRenderContext, buildWidgetContext } from './widgetUtils';

import styles from './DashboardGrid.module.css';

interface Props {
  layout: DashboardLayoutJson;
  editing: boolean;
  selectedWidgetId: string | null;
  refreshKey: number;
  onSelectWidget?: (widgetId: string | null) => void;
  onEditWidget?: (widget: DashboardWidget) => void;
  onDeleteWidget?: (widgetId: string) => void;
  onLayoutChange?: (widget: DashboardWidget, newLayout: DashboardWidgetLayout) => void;
  onRefreshWidget?: (widgetId: string) => void;
  /** Per-widget refresh keys, used so individual widget refresh works. */
  widgetRefreshKeys?: Record<string, number>;
}

interface DragState {
  widgetId: string;
  mode: 'move' | 'resize';
  startX: number;
  startY: number;
  origin: DashboardWidgetLayout;
  /** Cell width in pixels — recomputed from container at start. */
  cellWidth: number;
  cellHeight: number;
}

const DashboardGrid = ({
  layout,
  editing,
  selectedWidgetId,
  refreshKey,
  onSelectWidget,
  onEditWidget,
  onDeleteWidget,
  onLayoutChange,
  onRefreshWidget,
  widgetRefreshKeys,
}: Props) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [drag, setDrag] = React.useState<DragState | null>(null);
  // Live preview position while dragging; committed to layout on pointerup.
  const [preview, setPreview] = React.useState<DashboardWidgetLayout | null>(null);
  const cols = layout.gridColumns ?? 12;

  React.useEffect(() => {
    if (drag == null) return undefined;

    const handleMove = (e: PointerEvent) => {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const dCol = Math.round(dx / drag.cellWidth);
      const dRow = Math.round(dy / drag.cellHeight);

      let next: DashboardWidgetLayout;
      if (drag.mode === 'move') {
        next = {
          ...drag.origin,
          x: clamp(drag.origin.x + dCol, 0, cols - drag.origin.w),
          y: Math.max(0, drag.origin.y + dRow),
        };
      } else {
        next = {
          ...drag.origin,
          w: clamp(drag.origin.w + dCol, 1, cols - drag.origin.x),
          h: Math.max(1, drag.origin.h + dRow),
        };
      }
      setPreview(next);
    };

    const handleUp = () => {
      const widget = layout.widgets.find((w) => w.id === drag.widgetId);
      if (preview && widget && onLayoutChange) {
        onLayoutChange(widget, preview);
      }
      setDrag(null);
      setPreview(null);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [drag, preview, cols, layout.widgets, onLayoutChange]);

  const startDrag = (mode: 'move' | 'resize', widget: DashboardWidget) => (e: React.PointerEvent<HTMLElement>) => {
    if (!editing) return;
    e.preventDefault();
    const container = containerRef.current;
    if (container == null) return;
    const rect = container.getBoundingClientRect();
    const cellWidth = (rect.width - (cols - 1) * 8) / cols;
    setDrag({
      widgetId: widget.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origin: { ...widget.layout },
      cellWidth,
      cellHeight: 56 + 8, // grid-auto-rows + gap
    });
    setPreview({ ...widget.layout });
  };

  return (
    <div ref={containerRef} className={styles.gridContainer} style={{ ['--dashboard-grid-cols' as never]: cols }}>
      {layout.widgets.map((widget) => {
        const useLayout = drag && drag.widgetId === widget.id && preview ? preview : widget.layout;
        const widgetCtx: WidgetRenderContext = buildWidgetContext(
          widget,
          layout,
          (widgetRefreshKeys?.[widget.id] ?? 0) + refreshKey
        );
        return (
          <div
            key={widget.id}
            className={styles.gridItem}
            style={{
              gridColumn: `${useLayout.x + 1} / span ${useLayout.w}`,
              gridRow: `${useLayout.y + 1} / span ${useLayout.h}`,
            }}
          >
            <DashboardWidgetFrame
              widget={widget}
              editing={editing}
              selected={selectedWidgetId === widget.id}
              onSelect={() => onSelectWidget?.(widget.id)}
              onEdit={onEditWidget ? () => onEditWidget(widget) : undefined}
              onDelete={onDeleteWidget ? () => onDeleteWidget(widget.id) : undefined}
              onRefresh={onRefreshWidget ? () => onRefreshWidget(widget.id) : undefined}
              onPointerDownDrag={startDrag('move', widget)}
              onPointerDownResize={startDrag('resize', widget)}
            >
              {renderWidget(widget, widgetCtx)}
            </DashboardWidgetFrame>
          </div>
        );
      })}
    </div>
  );
};

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(v, hi));
}

export default DashboardGrid;
