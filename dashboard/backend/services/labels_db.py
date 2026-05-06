"""Postgres-backed label analytics.

Queries the same ``entity_labels`` table that
``example_plugins/src/services/labels_service.py`` writes to via
``EntityLabelsModel``. Each row stores ``entity_key`` (string) and ``labels``
(JSONB) — labels are a dict of ``{label_name: {status, expires_at, ...}}``.
"""

from __future__ import annotations

import logging
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from ..config import Settings

logger = logging.getLogger(__name__)


class LabelsDB:
    """Read-only Postgres client for label analytics."""

    def __init__(self, settings: Settings, engine: Optional[Engine] = None) -> None:
        self._settings = settings
        # ``pool_pre_ping`` keeps the dashboard from holding stale connections
        # if Postgres is restarted while the FastAPI worker is up.
        self._engine: Engine = engine or create_engine(
            settings.postgres_url,
            pool_pre_ping=True,
            pool_size=4,
            max_overflow=4,
            future=True,
        )

    def dispose(self) -> None:
        self._engine.dispose()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _entity_label_rows(self) -> List[Tuple[str, Dict[str, Any]]]:
        """Return ``(entity_key, labels_json)`` rows.

        Returns an empty list when the table doesn't exist yet (first-run, no
        labels written).
        """
        try:
            with self._engine.connect() as conn:
                result = conn.execute(text('SELECT entity_key, labels FROM entity_labels'))
                return [(row[0], row[1] or {}) for row in result]
        except Exception as exc:
            logger.info('Labels table query failed (likely empty / not yet created): %s', exc)
            return []

    @staticmethod
    def _iter_label_entries(labels: Dict[str, Any]):
        """Yield ``(label_name, label_payload)`` for the JSON we store."""
        if not isinstance(labels, dict):
            return
        for name, payload in labels.items():
            if isinstance(payload, dict):
                yield name, payload
            else:
                # Some serialisations may be ``{"name": "active"}`` or just the status.
                yield name, {'status': payload}

    @staticmethod
    def _parse_iso(value: Any) -> Optional[datetime]:
        if not value:
            return None
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        if isinstance(value, str):
            try:
                parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
                return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
            except ValueError:
                return None
        return None

    # ------------------------------------------------------------------
    # Public analytics
    # ------------------------------------------------------------------

    def total_labeled_entities(self) -> int:
        try:
            with self._engine.connect() as conn:
                result = conn.execute(text('SELECT COUNT(*) FROM entity_labels'))
                return int(result.scalar() or 0)
        except Exception:
            return 0

    def label_distribution(self) -> List[Dict[str, Any]]:
        counter: Counter[str] = Counter()
        for _, labels in self._entity_label_rows():
            for name, payload in self._iter_label_entries(labels):
                if str(payload.get('status', 'active')).lower() == 'removed':
                    continue
                counter[name] += 1
        return [{'label_name': name, 'count': count} for name, count in counter.most_common()]

    def recently_applied(self, hours: int = 24) -> List[Dict[str, Any]]:
        since = datetime.now(tz=timezone.utc) - timedelta(hours=hours)
        counter: Counter[str] = Counter()
        for _, labels in self._entity_label_rows():
            for name, payload in self._iter_label_entries(labels):
                created = self._parse_iso(payload.get('created_at') or payload.get('applied_at'))
                if created and created >= since:
                    counter[name] += 1
        return [{'label_name': name, 'count': count} for name, count in counter.most_common(50)]

    def expiring_soon(self, hours: int = 24) -> List[Dict[str, Any]]:
        now = datetime.now(tz=timezone.utc)
        horizon = now + timedelta(hours=hours)
        counter: Counter[str] = Counter()
        for _, labels in self._entity_label_rows():
            for name, payload in self._iter_label_entries(labels):
                expires = self._parse_iso(payload.get('expires_at'))
                if expires and now <= expires <= horizon:
                    counter[name] += 1
        return [{'label_name': name, 'count': count} for name, count in counter.most_common(50)]

    def top_entities(self, limit: int = 25) -> List[Dict[str, Any]]:
        rows = self._entity_label_rows()
        scored: List[Dict[str, Any]] = []
        for entity_key, labels in rows:
            active_labels = [
                name
                for name, payload in self._iter_label_entries(labels)
                if str(payload.get('status', 'active')).lower() != 'removed'
            ]
            scored.append(
                {
                    'entity_key': entity_key,
                    'label_count': len(active_labels),
                    'labels': active_labels,
                }
            )
        scored.sort(key=lambda r: r['label_count'], reverse=True)
        return scored[:limit]
