import { ReactNode } from "react";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function renderAsync<T>(
  state: AsyncState<T>,
  render: (data: T) => ReactNode,
  fallback?: ReactNode,
): ReactNode {
  if (state.loading && !state.data) {
    return (
      <div className="empty-state">
        <span className="spinner" /> Loading…
      </div>
    );
  }
  if (state.error && !state.data) {
    return <div className="error-banner">{state.error}</div>;
  }
  if (!state.data) {
    return fallback ?? <div className="empty-state">No data</div>;
  }
  return render(state.data);
}
