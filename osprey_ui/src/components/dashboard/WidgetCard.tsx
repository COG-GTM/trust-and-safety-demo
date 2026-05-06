import * as React from 'react';
import { CloseOutlined, SettingOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import classNames from 'classnames';

import styles from './WidgetCard.module.css';

interface WidgetCardProps {
  title: string;
  onConfigure?: () => void;
  onRemove?: () => void;
  isEditing: boolean;
  children: React.ReactNode;
  className?: string;
}

const WidgetCard: React.FC<WidgetCardProps> = ({ title, onConfigure, onRemove, isEditing, children, className }) => {
  const headerClass = classNames(styles.header, isEditing ? 'react-grid-item-drag-handle' : undefined);

  return (
    <div className={classNames(styles.widgetCard, className)}>
      <div className={headerClass}>
        <div className={styles.title} title={title}>
          {title}
        </div>
        {isEditing ? (
          <div className={styles.actions} onMouseDown={(e) => e.stopPropagation()}>
            {onConfigure != null && (
              <Tooltip title="Configure">
                <Button
                  size="small"
                  type="text"
                  icon={<SettingOutlined />}
                  onClick={onConfigure}
                  aria-label="Configure widget"
                />
              </Tooltip>
            )}
            {onRemove != null && (
              <Tooltip title="Remove">
                <Button
                  size="small"
                  type="text"
                  icon={<CloseOutlined />}
                  onClick={onRemove}
                  aria-label="Remove widget"
                />
              </Tooltip>
            )}
          </div>
        ) : null}
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
};

export default WidgetCard;
