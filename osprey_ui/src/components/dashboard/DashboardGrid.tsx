import * as React from 'react';
import { Empty } from 'antd';
import { Layout, Responsive, WidthProvider } from 'react-grid-layout';

import {
  DashboardWidget,
  DistributionWidgetConfig,
  KpiWidgetConfig,
  LiveStreamWidgetConfig,
  TimeseriesWidgetConfig,
  TopEntitiesWidgetConfig,
  WIDGET_LABELS,
  WidgetTypes,
} from '../../types/DashboardTypes';
import DistributionWidget from './widgets/DistributionWidget';
import EventVolumeKPIWidget from './widgets/EventVolumeKPIWidget';
import LabelActivityWidget from './widgets/LabelActivityWidget';
import LiveEventStreamWidget from './widgets/LiveEventStreamWidget';
import RuleHitsTimeSeriesWidget from './widgets/RuleHitsTimeSeriesWidget';
import TopEntitiesWidget from './widgets/TopEntitiesWidget';
import WidgetCard from './WidgetCard';

import styles from './DashboardGrid.module.css';

const ResponsiveGrid = WidthProvider(Responsive);

interface Props {
  widgets: DashboardWidget[];
  layouts: Layout[];
  isEditing: boolean;
  onLayoutChange: (layout: Layout[]) => void;
  onConfigureWidget: (id: string) => void;
  onRemoveWidget: (id: string) => void;
}

function renderWidgetBody(widget: DashboardWidget): React.ReactNode {
  switch (widget.type) {
    case WidgetTypes.KPI:
      return <EventVolumeKPIWidget config={widget.config as KpiWidgetConfig} />;
    case WidgetTypes.RULE_HITS_TIMESERIES:
      return <RuleHitsTimeSeriesWidget config={widget.config as TimeseriesWidgetConfig} />;
    case WidgetTypes.RULE_DISTRIBUTION:
      return (
        <DistributionWidget
          config={widget.config as DistributionWidgetConfig}
          source="rule"
          defaultDimension="ActionName"
        />
      );
    case WidgetTypes.EFFECTS_BREAKDOWN:
      return (
        <DistributionWidget
          config={widget.config as DistributionWidgetConfig}
          source="effects"
          defaultDimension="EffectName"
        />
      );
    case WidgetTypes.TOP_ENTITIES: {
      const topEntitiesConfig = widget.config as Partial<TopEntitiesWidgetConfig>;
      return (
        <TopEntitiesWidget config={{ ...topEntitiesConfig, dimension: topEntitiesConfig.dimension || 'UserId' }} />
      );
    }
    case WidgetTypes.LIVE_EVENT_STREAM:
      return <LiveEventStreamWidget config={widget.config as LiveStreamWidgetConfig} />;
    case WidgetTypes.LABEL_ACTIVITY:
      return <LabelActivityWidget config={widget.config as DistributionWidgetConfig} />;
    default:
      return null;
  }
}

const DashboardGrid: React.FC<Props> = ({
  widgets,
  layouts,
  isEditing,
  onLayoutChange,
  onConfigureWidget,
  onRemoveWidget,
}) => {
  if (widgets.length === 0) {
    return (
      <div className={styles.empty}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No widgets yet — click 'Add widget' to get started" />
      </div>
    );
  }

  const layoutsByBreakpoint = { lg: layouts, md: layouts, sm: layouts, xs: layouts, xxs: layouts };

  // Only forward layout changes when the user is actively editing. The Responsive
  // grid fires onLayoutChange on initial mount and whenever it auto-adjusts
  // positions for a new breakpoint (different column counts). Persisting those
  // automatic adjustments would mark a clean dashboard as dirty and risk
  // overwriting the saved layout with breakpoint-specific positions.
  const handleLayoutChange = isEditing ? (layout: Layout[]) => onLayoutChange(layout) : undefined;

  return (
    <div className={styles.dashboardGrid}>
      <ResponsiveGrid
        className="layout"
        layouts={layoutsByBreakpoint}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={48}
        margin={[12, 12]}
        isDraggable={isEditing}
        isResizable={isEditing}
        draggableHandle=".react-grid-item-drag-handle"
        onLayoutChange={handleLayoutChange}
      >
        {widgets.map((widget) => {
          const title = (widget.config.title as string) || WIDGET_LABELS[widget.type];
          return (
            <div key={widget.id}>
              <WidgetCard
                title={title}
                isEditing={isEditing}
                onConfigure={() => onConfigureWidget(widget.id)}
                onRemove={() => onRemoveWidget(widget.id)}
              >
                {renderWidgetBody(widget)}
              </WidgetCard>
            </div>
          );
        })}
      </ResponsiveGrid>
    </div>
  );
};

export default DashboardGrid;
