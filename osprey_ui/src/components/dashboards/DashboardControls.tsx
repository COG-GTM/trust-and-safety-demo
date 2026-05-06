import * as React from 'react';
import { Button, Input, InputNumber, Select, Switch, Tooltip } from 'antd';
import { CopyOutlined, ReloadOutlined, ExportOutlined } from '@ant-design/icons';

import { DashboardLayoutJson, DashboardTimeRange } from '../../types/DashboardTypes';
import { TIME_RANGE_OPTIONS } from '../../utils/DashboardUtils';

import styles from './DashboardControls.module.css';

interface Props {
  layout: DashboardLayoutJson;
  editing: boolean;
  onChangeTimeRange: (range: DashboardTimeRange) => void;
  onChangeQueryFilter: (filter: string) => void;
  onChangeRefreshInterval: (seconds: number) => void;
  onForceRefresh: () => void;
  onShare: () => void;
  onExport: () => void;
}

const DashboardControls = ({
  layout,
  editing,
  onChangeTimeRange,
  onChangeQueryFilter,
  onChangeRefreshInterval,
  onForceRefresh,
  onShare,
  onExport,
}: Props) => {
  const [filterDraft, setFilterDraft] = React.useState(layout.globalQueryFilter ?? '');
  React.useEffect(() => setFilterDraft(layout.globalQueryFilter ?? ''), [layout.globalQueryFilter]);

  return (
    <div className={styles.controlsBar}>
      <div className={styles.group}>
        <label htmlFor="dash-time-range">Time range</label>
        <Select
          id="dash-time-range"
          size="small"
          style={{ width: 170 }}
          value={layout.defaultTimeRange?.interval ?? '24h'}
          onChange={(value) => onChangeTimeRange({ interval: value as string })}
          options={TIME_RANGE_OPTIONS.filter((o) => o.value !== 'custom')}
          disabled={!editing}
        />
      </div>
      <div className={styles.group} style={{ flex: 1, minWidth: 240 }}>
        <label htmlFor="dash-filter">Filter</label>
        <Input
          id="dash-filter"
          size="small"
          placeholder='e.g. ActionName = "post_created"'
          value={filterDraft}
          onChange={(e) => setFilterDraft(e.target.value)}
          onBlur={() => onChangeQueryFilter(filterDraft)}
          onPressEnter={() => onChangeQueryFilter(filterDraft)}
          disabled={!editing}
        />
      </div>
      <div className={styles.group}>
        <label htmlFor="dash-auto-refresh">Auto-refresh</label>
        <Switch
          id="dash-auto-refresh"
          size="small"
          disabled={!editing}
          checked={(layout.refreshIntervalSeconds ?? 0) > 0}
          onChange={(checked) => onChangeRefreshInterval(checked ? 30 : 0)}
        />
        <InputNumber
          size="small"
          min={5}
          max={3600}
          style={{ width: 80 }}
          value={layout.refreshIntervalSeconds || undefined}
          placeholder="seconds"
          disabled={!editing || (layout.refreshIntervalSeconds ?? 0) === 0}
          onChange={(value) => onChangeRefreshInterval(typeof value === 'number' ? value : 0)}
        />
      </div>
      <div className={styles.group}>
        <Tooltip title="Refresh now">
          <Button size="small" icon={<ReloadOutlined />} onClick={onForceRefresh}>
            Refresh
          </Button>
        </Tooltip>
        <Tooltip title="Copy share link">
          <Button size="small" icon={<CopyOutlined />} onClick={onShare}>
            Share
          </Button>
        </Tooltip>
        <Tooltip title="Export dashboard config as JSON">
          <Button size="small" icon={<ExportOutlined />} onClick={onExport}>
            Export
          </Button>
        </Tooltip>
      </div>
    </div>
  );
};

export default DashboardControls;
