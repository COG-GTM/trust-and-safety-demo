import * as React from 'react';
import { Modal } from 'antd';

import { WIDGET_DESCRIPTIONS, WIDGET_LABELS, WidgetType, WidgetTypes } from '../../types/DashboardTypes';

import styles from './AddWidgetModal.module.css';

interface Props {
  open: boolean;
  onCancel: () => void;
  onSelect: (type: WidgetType) => void;
}

const ORDERED_TYPES: WidgetType[] = [
  WidgetTypes.KPI,
  WidgetTypes.RULE_HITS_TIMESERIES,
  WidgetTypes.RULE_DISTRIBUTION,
  WidgetTypes.EFFECTS_BREAKDOWN,
  WidgetTypes.TOP_ENTITIES,
  WidgetTypes.LABEL_ACTIVITY,
  WidgetTypes.LIVE_EVENT_STREAM,
];

const AddWidgetModal: React.FC<Props> = ({ open, onCancel, onSelect }) => (
  <Modal title="Add a widget" open={open} onCancel={onCancel} footer={null} width={640}>
    <div className={styles.grid}>
      {ORDERED_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          className={styles.tile}
          onClick={() => {
            onSelect(type);
          }}
        >
          <div className={styles.tileTitle}>{WIDGET_LABELS[type]}</div>
          <div className={styles.tileDescription}>{WIDGET_DESCRIPTIONS[type]}</div>
        </button>
      ))}
    </div>
  </Modal>
);

export default AddWidgetModal;
