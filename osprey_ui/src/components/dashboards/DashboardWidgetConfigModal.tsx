import * as React from 'react';
import { Form, Input, InputNumber, Modal, Select } from 'antd';

import { DashboardWidget, DashboardWidgetType } from '../../types/DashboardTypes';
import { GRANULARITY_OPTIONS, TIME_RANGE_OPTIONS } from '../../utils/DashboardUtils';
import { WIDGET_REGISTRY } from './widgets/registry';

interface Props {
  open: boolean;
  widget: DashboardWidget;
  onCancel: () => void;
  onSave: (widget: DashboardWidget) => void;
}

const DashboardWidgetConfigModal = ({ open, widget, onCancel, onSave }: Props) => {
  const [draft, setDraft] = React.useState<DashboardWidget>(widget);

  React.useEffect(() => {
    setDraft(widget);
  }, [widget]);

  const set = <K extends keyof DashboardWidget>(key: K, value: DashboardWidget[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };
  const setData = (patch: Partial<DashboardWidget['dataSource']>) => {
    setDraft((d) => ({ ...d, dataSource: { ...d.dataSource, ...patch } }));
  };
  const setOptions = (patch: Partial<NonNullable<DashboardWidget['options']>>) => {
    setDraft((d) => ({ ...d, options: { ...(d.options ?? {}), ...patch } }));
  };
  const setTimeInterval = (interval: string) => {
    setDraft((d) => ({ ...d, timeRange: interval ? { interval } : undefined }));
  };

  return (
    <Modal
      open={open}
      title="Configure widget"
      okText="Save"
      onOk={() => onSave(draft)}
      onCancel={onCancel}
      width={620}
      destroyOnClose
    >
      <Form layout="vertical">
        <Form.Item label="Widget type">
          <Select
            value={draft.type}
            onChange={(value) => set('type', value as DashboardWidgetType)}
            options={Object.entries(WIDGET_REGISTRY).map(([key, entry]) => ({ value: key, label: entry.label }))}
          />
        </Form.Item>
        <Form.Item label="Title">
          <Input value={draft.title} onChange={(e) => set('title', e.target.value)} />
        </Form.Item>
        <Form.Item label="Description">
          <Input
            value={draft.options?.description ?? ''}
            placeholder="Optional helper text"
            onChange={(e) => setOptions({ description: e.target.value })}
          />
        </Form.Item>
        <Form.Item label="Time range (overrides dashboard global)">
          <Select
            allowClear
            placeholder="Use dashboard global"
            value={draft.timeRange?.interval}
            onChange={(value) => setTimeInterval(value as string)}
            options={TIME_RANGE_OPTIONS.filter((o) => o.value !== 'custom')}
          />
        </Form.Item>
        <Form.Item label="Granularity (time-series widgets)">
          <Select
            allowClear
            value={draft.dataSource.granularity}
            onChange={(value) => setData({ granularity: value as string })}
            options={GRANULARITY_OPTIONS}
          />
        </Form.Item>
        <Form.Item label="Group-by dimension (top-N widgets)">
          <Select
            allowClear
            value={draft.dataSource.dimension}
            onChange={(value) => setData({ dimension: value as string | undefined })}
            options={[
              { value: 'Verdict', label: 'Verdict' },
              { value: 'RuleName', label: 'Rule name' },
              { value: 'ActionName', label: 'Action name' },
              { value: 'EntityKey', label: 'Entity key' },
            ]}
          />
        </Form.Item>
        <Form.Item label="Top-N limit">
          <InputNumber
            min={1}
            max={500}
            value={draft.dataSource.limit}
            onChange={(value) => setData({ limit: typeof value === 'number' ? value : undefined })}
          />
        </Form.Item>
        <Form.Item label="Filter expression (SML)">
          <Input.TextArea
            rows={2}
            value={draft.dataSource.queryFilter ?? ''}
            placeholder='e.g. ActionName = "post_created"'
            onChange={(e) => setData({ queryFilter: e.target.value })}
          />
        </Form.Item>
        <Form.Item label="Refresh every (seconds, 0 = use dashboard default)">
          <InputNumber
            min={0}
            max={3600}
            value={draft.refreshIntervalSeconds ?? 0}
            onChange={(value) => set('refreshIntervalSeconds', typeof value === 'number' ? value : 0)}
          />
        </Form.Item>
        <Form.Item label="Primary color (hex)">
          <Input
            value={draft.options?.primaryColor ?? ''}
            placeholder="#1227ce"
            onChange={(e) => setOptions({ primaryColor: e.target.value || undefined })}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default DashboardWidgetConfigModal;
