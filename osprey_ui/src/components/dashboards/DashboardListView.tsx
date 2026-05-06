import * as React from 'react';
import { Button, Modal, Input, Form, Select, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useHistory } from 'react-router-dom';

import { createDashboard, listDashboards } from '../../actions/DashboardActions';
import useDashboardStore from '../../stores/DashboardStore';
import usePromiseResult from '../../hooks/usePromiseResult';
import { DashboardSummary } from '../../types/DashboardTypes';
import { renderFromPromiseResult } from '../../utils/PromiseResultUtils';
import { DASHBOARD_TEMPLATES, EMPTY_LAYOUT } from './DashboardTemplates';

import styles from './DashboardListView.module.css';

const DashboardListView = () => {
  const history = useHistory();
  const { dashboards, setDashboards } = useDashboardStore();
  const [createOpen, setCreateOpen] = React.useState(false);

  const loadResult = usePromiseResult(async () => {
    const list = await listDashboards();
    setDashboards(list);
  }, []);

  return renderFromPromiseResult(loadResult, () => (
    <div className={styles.viewContainer}>
      <div className={styles.header}>
        <div>
          <h2 style={{ margin: 0 }}>Analytics Dashboards</h2>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>
            Build custom views over Druid analytics and Postgres label data.
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            New dashboard
          </Button>
        </div>
      </div>

      {dashboards.length === 0 ? (
        <div className={styles.empty}>
          You don&apos;t have any saved dashboards yet. Create one from a template below or start blank.
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {dashboards.map((d) => (
            <DashboardCard key={d.id} dashboard={d} />
          ))}
        </div>
      )}

      <div className={styles.templateSection}>
        <div className={styles.templateTitle}>Start from a template</div>
        <div className={styles.cardGrid}>
          {DASHBOARD_TEMPLATES.map((template) => (
            <div
              key={template.key}
              className={styles.card}
              role="button"
              tabIndex={0}
              onClick={async () => {
                const created = await createDashboard({
                  name: template.name,
                  description: template.description,
                  layout_json: template.build(),
                });
                if (created) {
                  history.push(`/dashboards/${created.id}`);
                } else {
                  message.error('Failed to create dashboard from template.');
                }
              }}
            >
              <div className={styles.cardTitle}>{template.name}</div>
              <div className={styles.cardDescription}>{template.description}</div>
              <div className={styles.cardFooter}>
                <span>Template</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <CreateDashboardModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  ));
};

interface CardProps {
  dashboard: DashboardSummary;
}
const DashboardCard = ({ dashboard }: CardProps) => {
  const history = useHistory();
  return (
    <div className={styles.card} role="button" tabIndex={0} onClick={() => history.push(`/dashboards/${dashboard.id}`)}>
      <div className={styles.cardTitle}>{dashboard.name}</div>
      <div className={styles.cardOwner}>by {dashboard.owner}</div>
      {dashboard.description ? <div className={styles.cardDescription}>{dashboard.description}</div> : null}
      <div className={styles.cardFooter}>
        <span>Updated {new Date(dashboard.updated_at).toLocaleString()}</span>
        {dashboard.is_template ? <span>Template</span> : null}
      </div>
    </div>
  );
};

interface CreateDashboardModalProps {
  open: boolean;
  onClose: () => void;
}
const CreateDashboardModal = ({ open, onClose }: CreateDashboardModalProps) => {
  const history = useHistory();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [templateKey, setTemplateKey] = React.useState<string>('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setTemplateKey('');
    }
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) {
      message.warning('Please enter a name');
      return;
    }
    setSubmitting(true);
    try {
      const layout = templateKey ? DASHBOARD_TEMPLATES.find((t) => t.key === templateKey)?.build() : EMPTY_LAYOUT;
      const created = await createDashboard({
        name: name.trim(),
        description: description.trim() || undefined,
        layout_json: layout ?? EMPTY_LAYOUT,
      });
      if (!created) {
        message.error('Failed to create dashboard');
        return;
      }
      onClose();
      history.push(`/dashboards/${created.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="New dashboard"
      onCancel={onClose}
      onOk={handleCreate}
      okText="Create"
      okButtonProps={{ loading: submitting }}
    >
      <Form layout="vertical">
        <Form.Item label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </Form.Item>
        <Form.Item label="Description">
          <Input.TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </Form.Item>
        <Form.Item label="Start from template (optional)">
          <Select
            allowClear
            value={templateKey || undefined}
            onChange={(value) => setTemplateKey((value as string) || '')}
            options={DASHBOARD_TEMPLATES.map((t) => ({ value: t.key, label: t.name }))}
            placeholder="Blank"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default DashboardListView;
