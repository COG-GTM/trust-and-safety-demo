import * as React from 'react';
import { Button, Modal, Select, Space, Tooltip, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { useHistory, useParams } from 'react-router-dom';

import { deleteDashboard, getDashboard, listDashboards, updateDashboard } from '../../actions/DashboardActions';
import useDashboardStore from '../../stores/DashboardStore';
import usePromiseResult from '../../hooks/usePromiseResult';
import {
  DashboardLayoutJson,
  DashboardSummary,
  DashboardWidget,
  DashboardWidgetLayout,
  DashboardWidgetType,
} from '../../types/DashboardTypes';
import { Routes } from '../../Constants';
import { renderFromPromiseResult } from '../../utils/PromiseResultUtils';
import { findNextWidgetSlot, makeDefaultWidget } from '../../utils/DashboardUtils';
import DashboardControls from './DashboardControls';
import DashboardGrid from './DashboardGrid';
import DashboardWidgetConfigModal from './DashboardWidgetConfigModal';
import { WIDGET_REGISTRY } from './widgets/registry';
import { useDashboardRefreshTick } from './widgetUtils';

import styles from './DashboardView.module.css';

const DashboardView = () => {
  const history = useHistory();
  const { dashboardId } = useParams<{ dashboardId: string }>();

  const {
    dashboards,
    setDashboards,
    current,
    setCurrent,
    editMode,
    setEditMode,
    selectedWidgetId,
    setSelectedWidgetId,
    draftLayout,
    addDraftWidget,
    removeDraftWidget,
    updateDraftWidget,
    setDraftGlobalQueryFilter,
    setDraftGlobalTimeRange,
    setDraftRefreshIntervalSeconds,
  } = useDashboardStore();

  const [editingWidget, setEditingWidget] = React.useState<DashboardWidget | null>(null);
  const [addModalOpen, setAddModalOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [widgetRefreshKeys, setWidgetRefreshKeys] = React.useState<Record<string, number>>({});

  const loadResult = usePromiseResult(async () => {
    const [list, dashboard] = await Promise.all([listDashboards(), getDashboard(dashboardId)]);
    setDashboards(list);
    setCurrent(dashboard);
  }, [dashboardId]);

  const layout: DashboardLayoutJson | null = editMode ? draftLayout : (current?.layout_json ?? null);
  const refreshSeconds = layout?.refreshIntervalSeconds ?? 0;
  const { tick: pollTick, force: forcePoll } = useDashboardRefreshTick(editMode ? 0 : refreshSeconds);

  const refreshAll = React.useCallback(() => {
    setWidgetRefreshKeys({});
    forcePoll();
  }, [forcePoll]);

  const handleStartEdit = () => {
    setEditMode(true);
  };

  const handleSave = async () => {
    if (current == null || draftLayout == null) return;
    setSaving(true);
    try {
      const updated = await updateDashboard(current.id, { layout_json: draftLayout });
      if (!updated) {
        message.error('Failed to save dashboard');
        return;
      }
      setCurrent(updated);
      setEditMode(false);
      message.success('Saved');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setEditMode(false);
  };

  const handleDelete = () => {
    if (current == null) return;
    Modal.confirm({
      title: `Delete dashboard "${current.name}"?`,
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        const ok = await deleteDashboard(current.id);
        if (ok) {
          message.success('Dashboard deleted');
          history.push(Routes.DASHBOARDS);
        } else {
          message.error('Failed to delete dashboard');
        }
      },
    });
  };

  const handleAddWidget = (type: DashboardWidgetType) => {
    if (!editMode || draftLayout == null) return;
    const widget = makeDefaultWidget(type);
    const slot = findNextWidgetSlot(draftLayout, widget.layout.w, widget.layout.h);
    widget.layout = { ...widget.layout, ...slot };
    addDraftWidget(widget);
    setAddModalOpen(false);
    setSelectedWidgetId(widget.id);
  };

  const handleLayoutChange = (widget: DashboardWidget, newLayout: DashboardWidgetLayout) => {
    if (!editMode) return;
    updateDraftWidget({ ...widget, layout: newLayout });
  };

  const handleEditWidget = (widget: DashboardWidget) => {
    setEditingWidget(widget);
  };

  const handleSaveEditedWidget = (next: DashboardWidget) => {
    updateDraftWidget(next);
    setEditingWidget(null);
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      message.success('Share link copied to clipboard');
    } catch {
      message.info(url);
    }
  };

  const handleExport = () => {
    if (current == null || layout == null) return;
    const exportData = {
      ...current,
      layout_json: layout,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${current.name.replace(/\W+/g, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRefreshWidget = (widgetId: string) => {
    setWidgetRefreshKeys((keys) => ({ ...keys, [widgetId]: (keys[widgetId] ?? 0) + 1 }));
  };

  return renderFromPromiseResult(loadResult, () => {
    if (current == null || layout == null) {
      return (
        <div className={styles.viewContainer}>
          <div className={styles.empty}>
            Dashboard not found.{' '}
            <Button type="link" onClick={() => history.push(Routes.DASHBOARDS)}>
              Back to dashboards
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.viewContainer}>
        <div className={styles.viewHeader}>
          <div className={styles.titleArea}>
            <h2 className={styles.title}>{current.name}</h2>
            {current.description ? <span className={styles.subtitle}>{current.description}</span> : null}
          </div>
          <div className={styles.headerActions}>
            <Tooltip title="Switch dashboard">
              <Select
                className={styles.switcher}
                value={current.id}
                onChange={(value) => history.push(`/dashboards/${value}`)}
                options={dashboards.map((d: DashboardSummary) => ({ value: d.id, label: d.name }))}
                showSearch
                optionFilterProp="label"
              />
            </Tooltip>
            {editMode ? (
              <Space>
                <Button icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>
                  Add widget
                </Button>
                <Button icon={<SaveOutlined />} type="primary" loading={saving} onClick={handleSave}>
                  Save
                </Button>
                <Button onClick={handleDiscard} disabled={saving}>
                  Discard
                </Button>
              </Space>
            ) : (
              <Space>
                <Button icon={<EditOutlined />} onClick={handleStartEdit}>
                  Edit
                </Button>
                <Button icon={<DeleteOutlined />} danger onClick={handleDelete}>
                  Delete
                </Button>
              </Space>
            )}
          </div>
        </div>

        <DashboardControls
          layout={layout}
          editing={editMode}
          onChangeTimeRange={setDraftGlobalTimeRange}
          onChangeQueryFilter={setDraftGlobalQueryFilter}
          onChangeRefreshInterval={setDraftRefreshIntervalSeconds}
          onForceRefresh={refreshAll}
          onShare={handleShare}
          onExport={handleExport}
        />

        {layout.widgets.length === 0 ? (
          <div className={styles.empty}>
            No widgets yet.{' '}
            {editMode ? (
              <Button type="link" onClick={() => setAddModalOpen(true)}>
                Add your first widget
              </Button>
            ) : (
              <Button type="link" onClick={handleStartEdit}>
                Edit dashboard to add widgets
              </Button>
            )}
          </div>
        ) : (
          <DashboardGrid
            layout={layout}
            editing={editMode}
            selectedWidgetId={selectedWidgetId}
            refreshKey={pollTick}
            onSelectWidget={setSelectedWidgetId}
            onEditWidget={handleEditWidget}
            onDeleteWidget={removeDraftWidget}
            onLayoutChange={handleLayoutChange}
            onRefreshWidget={handleRefreshWidget}
            widgetRefreshKeys={widgetRefreshKeys}
          />
        )}

        <Modal open={addModalOpen} title="Add widget" footer={null} onCancel={() => setAddModalOpen(false)} width={520}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {Object.entries(WIDGET_REGISTRY).map(([type, entry]) => (
              <Button
                key={type}
                size="large"
                style={{ height: 60, textAlign: 'left' }}
                onClick={() => handleAddWidget(type as DashboardWidgetType)}
              >
                <div style={{ fontWeight: 600 }}>{entry.label}</div>
              </Button>
            ))}
          </div>
        </Modal>

        {editingWidget ? (
          <DashboardWidgetConfigModal
            open
            widget={editingWidget}
            onCancel={() => setEditingWidget(null)}
            onSave={handleSaveEditedWidget}
          />
        ) : null}
      </div>
    );
  });
};

export default DashboardView;
