import { Dashboard, DashboardCreateRequest, DashboardLayout, DashboardUpdateRequest } from '../types/DashboardTypes';
import HTTPUtils, { HTTPResponse } from '../utils/HTTPUtils';

export async function listDashboards(createdBy?: string): Promise<Dashboard[]> {
  const response: HTTPResponse = await HTTPUtils.get('dashboards', {
    /* eslint-disable-next-line */
    params: createdBy != null ? { created_by: createdBy } : undefined,
  });
  if (!response.ok) return [];
  return response.data as Dashboard[];
}

export async function getDashboard(id: string): Promise<Dashboard | null> {
  const response: HTTPResponse = await HTTPUtils.get(`dashboards/${id}`);
  if (!response.ok) return null;
  return response.data as Dashboard;
}

export async function createDashboard(name: string, layout: DashboardLayout): Promise<Dashboard | null> {
  const payload: DashboardCreateRequest = { name, layout_json: layout };
  const response: HTTPResponse = await HTTPUtils.post('dashboards', payload);
  if (!response.ok) return null;
  return response.data as Dashboard;
}

export async function updateDashboard(id: string, updates: DashboardUpdateRequest): Promise<Dashboard | null> {
  const response: HTTPResponse = await HTTPUtils.put(`dashboards/${id}`, updates);
  if (!response.ok) return null;
  return response.data as Dashboard;
}

export async function deleteDashboard(id: string): Promise<boolean> {
  const response: HTTPResponse = await HTTPUtils.delete(`dashboards/${id}`);
  return response.ok;
}
