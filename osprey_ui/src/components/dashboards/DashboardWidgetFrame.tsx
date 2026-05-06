import * as React from 'react';
import classNames from 'classnames';
import { Button, Tooltip } from 'antd';
import { DeleteOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons';

import { DashboardWidget } from '../../types/DashboardTypes';

import styles from './DashboardWidgetFrame.module.css';

interface Props {
  widget: DashboardWidget;
  editing: boolean;
  selected: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onRefresh?: () => void;
  onPointerDownDrag?: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerDownResize?: (e: React.PointerEvent<HTMLElement>) => void;
  children: React.ReactNode;
}

const DashboardWidgetFrame = ({
  widget,
  editing,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onRefresh,
  onPointerDownDrag,
  onPointerDownResize,
  children,
}: Props) => {
  return (
    <div
      role="region"
      aria-label={widget.title}
      className={classNames(styles.frame, { [styles.editing]: editing, [styles.selected]: selected })}
      onClick={onSelect}
      style={{ position: 'relative' }}
    >
      <div className={styles.header} onPointerDown={editing ? onPointerDownDrag : undefined}>
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <div className={styles.title}>{widget.title}</div>
          {widget.options?.description ? <div className={styles.subtitle}>{widget.options.description}</div> : null}
        </div>
        <div className={styles.actions} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          {onRefresh ? (
            <Tooltip title="Refresh">
              <Button size="small" type="text" icon={<ReloadOutlined />} onClick={onRefresh} />
            </Tooltip>
          ) : null}
          {editing && onEdit ? (
            <Tooltip title="Configure">
              <Button size="small" type="text" icon={<EditOutlined />} onClick={onEdit} />
            </Tooltip>
          ) : null}
          {editing && onDelete ? (
            <Tooltip title="Remove">
              <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={onDelete} />
            </Tooltip>
          ) : null}
        </div>
      </div>
      <div className={styles.body}>{children}</div>
      {editing ? <div className={styles.resizeHandle} onPointerDown={onPointerDownResize} /> : null}
    </div>
  );
};

export default DashboardWidgetFrame;
