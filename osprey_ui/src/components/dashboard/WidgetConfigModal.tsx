import * as React from 'react';
import { Form, Input, InputNumber, Modal, Select } from 'antd';

import {
  DashboardWidget,
  TIME_WINDOWS,
  WidgetGranularity,
  WidgetTimeWindow,
  WidgetTypes,
} from '../../types/DashboardTypes';

interface Props {
  widget: DashboardWidget | null;
  onCancel: () => void;
  onSave: (id: string, config: Record<string, unknown>) => void;
}

const GRANULARITY_OPTIONS: { value: WidgetGranularity; label: string }[] = [
  { value: 'minute', label: 'Minute' },
  { value: 'fifteen_minute', label: '15 Minutes' },
  { value: 'thirty_minute', label: '30 Minutes' },
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const WidgetConfigModal: React.FC<Props> = ({ widget, onCancel, onSave }) => {
  const [form] = Form.useForm();

  React.useEffect(() => {
    if (widget != null) {
      form.setFieldsValue({
        title: widget.config.title ?? '',
        window: (widget.config.window as WidgetTimeWindow) ?? '24h',
        queryFilter: widget.config.queryFilter ?? '',
        dimension: widget.config.dimension ?? '',
        limit: widget.config.limit ?? 10,
        granularity: widget.config.granularity ?? 'hour',
      });
    }
  }, [widget, form]);

  if (widget == null) return null;

  const showDimension =
    widget.type === WidgetTypes.TOP_ENTITIES ||
    widget.type === WidgetTypes.RULE_DISTRIBUTION ||
    widget.type === WidgetTypes.EFFECTS_BREAKDOWN ||
    widget.type === WidgetTypes.LABEL_ACTIVITY;

  const showLimit = showDimension || widget.type === WidgetTypes.LIVE_EVENT_STREAM;
  const showGranularity = widget.type === WidgetTypes.RULE_HITS_TIMESERIES;

  const handleOk = () => {
    form
      .validateFields()
      .then((values) => {
        const cleaned: Record<string, unknown> = {};
        const stringFields = ['title', 'window', 'queryFilter', 'dimension', 'granularity'];
        const numericFields = ['limit'];
        for (const field of stringFields) {
          if (values[field] != null && values[field] !== '') {
            cleaned[field] = values[field];
          }
        }
        for (const field of numericFields) {
          if (values[field] != null && values[field] !== '') {
            cleaned[field] = Number(values[field]);
          }
        }
        onSave(widget.id, cleaned);
      })
      .catch(() => undefined);
  };

  return (
    <Modal title="Configure widget" open={widget != null} onCancel={onCancel} onOk={handleOk} okText="Save">
      <Form form={form} layout="vertical">
        <Form.Item label="Title" name="title">
          <Input placeholder="Optional override title" />
        </Form.Item>
        <Form.Item label="Time window" name="window">
          <Select options={TIME_WINDOWS.map((w) => ({ value: w.value, label: w.label }))} />
        </Form.Item>
        <Form.Item label="SML query filter" name="queryFilter" tooltip="Optional SML filter applied to this widget">
          <Input.TextArea rows={2} placeholder='ActionName == "user_phone_verification_completed"' />
        </Form.Item>
        {showDimension && (
          <Form.Item label="Dimension" name="dimension">
            <Input placeholder="UserId" />
          </Form.Item>
        )}
        {showLimit && (
          <Form.Item label="Result limit" name="limit">
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
        )}
        {showGranularity && (
          <Form.Item label="Granularity" name="granularity">
            <Select options={GRANULARITY_OPTIONS} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

export default WidgetConfigModal;
