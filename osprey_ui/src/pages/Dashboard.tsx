import * as React from 'react';
import { DeleteOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Dropdown, Input, Modal, Select, Tooltip, message } from 'antd';
import shallow from 'zustand/shallow';

import {
  createDashboard,
  deleteDashboard,
  getDashboard,
  listDashboards,
  updateDashboard,
} from '../actions/DashboardActions';
import AddWidgetModal from '../components/dashboard/AddWidgetModal';
import DashboardGrid from '../components/dashboard/DashboardGrid';
import WidgetConfigModal from '../components/dashboard/WidgetConfigModal';
import useDashboardStore from '../stores/DashboardStore';
import { Dashboard as DashboardType, DashboardWidget, WidgetType } from '../types/DashboardTypes';

import styles from './Dashboard.module.css';

const Dashboard: React.FC = () => {
  const [
    dashboards,
    currentDashboard,
    draftLayout,
    isDirty,
    setDashboards,
    setCurrentDashboard,
    addWidget,
    removeWidget,
    updateWidget,
    updateRglLayout,
    markClean,
  ] = useDashboardStore(
    (state) => [
      state.dashboards,
      state.currentDashboard,
      state.draftLayout,
      state.isDirty,
      state.setDashboards,
      state.setCurrentDashboard,
      state.addWidget,
      state.removeWidget,
      state.updateWidget,
      state.updateRglLayout,
      state.markClean,
    ],
    shallow
  );

  const [isAddWidgetOpen, setIsAddWidgetOpen] = React.useState(false);
  const [configuringWidgetId, setConfiguringWidgetId] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [newName, setNewName] = React.useState('My Dashboard');
  const [isEditing, setIsEditing] = React.useState(true);

  const refreshDashboards = React.useCallback(async () => {
    const list = await listDashboards();
    setDashboards(list);
    return list;
  }, [setDashboards]);

  React.useEffect(() => {
    let cancelled = false;
    refreshDashboards().then((list) => {
      if (cancelled) return;
      if (list.length > 0 && currentDashboard == null) {
        getDashboard(list[0].id).then((d) => {
          if (cancelled) return;
          setCurrentDashboard(d);
        });
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectDashboard = async (id: string) => {
    const fetched = await getDashboard(id);
    if (fetched != null) {
      setCurrentDashboard(fetched);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const created = await createDashboard(newName.trim(), { widgets: [], rgl: [] });
    if (created != null) {
      message.success(`Created dashboard "${created.name}"`);
      const list = await refreshDashboards();
      const reloaded = list.find((d) => d.id === created.id) ?? created;
      setCurrentDashboard(reloaded);
      setIsCreating(false);
      setNewName('My Dashboard');
    } else {
      message.error('Failed to create dashboard');
    }
  };

  const handleSave = async () => {
    if (currentDashboard == null) return;
    const updated = await updateDashboard(currentDashboard.id, {
      layout_json: draftLayout,
      name: currentDashboard.name,
    });
    if (updated != null) {
      message.success('Dashboard saved');
      setCurrentDashboard(updated);
      markClean();
      await refreshDashboards();
    } else {
      message.error('Failed to save dashboard');
    }
  };

  const handleDelete = async () => {
    if (currentDashboard == null) return;
    Modal.confirm({
      title: `Delete "${currentDashboard.name}"?`,
      content: 'This action cannot be undone.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        const ok = await deleteDashboard(currentDashboard.id);
        if (ok) {
          message.success('Dashboard deleted');
          const list = await refreshDashboards();
          const next = list[0] ?? null;
          if (next != null) {
            const fetched = await getDashboard(next.id);
            setCurrentDashboard(fetched);
          } else {
            setCurrentDashboard(null);
          }
        } else {
          message.error('Failed to delete dashboard');
        }
      },
    });
  };

  const handleSelectWidgetType = (type: WidgetType) => {
    const widget = addWidget(type, { window: '24h' });
    setIsAddWidgetOpen(false);
    setConfiguringWidgetId(widget.id);
  };

  const configuringWidget: DashboardWidget | null = React.useMemo(() => {
    if (configuringWidgetId == null) return null;
    return draftLayout.widgets.find((w) => w.id === configuringWidgetId) ?? null;
  }, [configuringWidgetId, draftLayout]);

  const dashboardOptions = dashboards.map((d: DashboardType) => ({
    value: d.id,
    label: d.name,
  }));

  return (
    <div className={styles.dashboardPage}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <Select
            className={styles.dashboardSelect}
            placeholder="Select a dashboard"
            options={dashboardOptions}
            value={currentDashboard?.id}
            onChange={handleSelectDashboard}
            notFoundContent="No dashboards yet"
          />
          {isDirty && (
            <Tooltip title="Unsaved changes">
              <span className={styles.dirtyDot} aria-label="Unsaved changes" />
            </Tooltip>
          )}
        </div>
        <div className={styles.toolbarRight}>
          <Button icon={<PlusOutlined />} onClick={() => setIsCreating(true)}>
            New
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsAddWidgetOpen(true)}
            disabled={currentDashboard == null}
          >
            Add widget
          </Button>
          <Button icon={<SaveOutlined />} onClick={handleSave} disabled={currentDashboard == null || !isDirty}>
            Save
          </Button>
          <Dropdown
            disabled={currentDashboard == null}
            menu={{
              items: [
                {
                  key: 'edit',
                  label: isEditing ? 'View mode' : 'Edit mode',
                  icon: <ReloadOutlined />,
                  onClick: () => setIsEditing((prev) => !prev),
                },
                {
                  key: 'delete',
                  label: 'Delete dashboard',
                  icon: <DeleteOutlined />,
                  onClick: handleDelete,
                  danger: true,
                },
              ],
            }}
          >
            <Button>More</Button>
          </Dropdown>
        </div>
      </div>

      <div className={styles.scroll}>
        <DashboardGrid
          widgets={draftLayout.widgets}
          layouts={draftLayout.rgl}
          isEditing={isEditing}
          onLayoutChange={(layout) => updateRglLayout(layout)}
          onConfigureWidget={(id) => setConfiguringWidgetId(id)}
          onRemoveWidget={(id) => {
            Modal.confirm({
              title: 'Remove widget?',
              okText: 'Remove',
              okButtonProps: { danger: true },
              onOk: () => removeWidget(id),
            });
          }}
        />
      </div>

      <AddWidgetModal
        open={isAddWidgetOpen}
        onCancel={() => setIsAddWidgetOpen(false)}
        onSelect={handleSelectWidgetType}
      />

      <WidgetConfigModal
        widget={configuringWidget}
        onCancel={() => setConfiguringWidgetId(null)}
        onSave={(id, config) => {
          updateWidget(id, config);
          setConfiguringWidgetId(null);
        }}
      />

      <Modal
        title="New dashboard"
        open={isCreating}
        onCancel={() => setIsCreating(false)}
        onOk={handleCreate}
        okText="Create"
      >
        <Input
          autoFocus
          placeholder="Dashboard name"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onPressEnter={handleCreate}
        />
      </Modal>
    </div>
  );
};

export default Dashboard;
