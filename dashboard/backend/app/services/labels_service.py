"""Reads labels from the Postgres ``entity_labels`` table populated by the
labels service plugin (see ``example_plugins/src/services/labels_service.py``).

The schema there is::

    entity_labels(
        entity_key VARCHAR PRIMARY KEY,
        labels JSONB NOT NULL,
    )

``labels`` is an EntityLabels JSON blob: a dict keyed by label name with a
status value (e.g. ``{"spam": "ADDED", "verified": "REMOVED"}``). We treat
any status that isn't ``REMOVED`` as an active label.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from ..db import get_dict_cursor, table_exists

logger = logging.getLogger(__name__)


def get_top_labels(limit: int = 10) -> List[Dict[str, Any]]:
    if not table_exists('entity_labels'):
        return []
    try:
        with get_dict_cursor() as cur:
            cur.execute(
                """
                WITH expanded AS (
                    SELECT entity_key, kv.key AS label, kv.value AS status_blob
                    FROM entity_labels, LATERAL jsonb_each(labels) AS kv
                )
                SELECT label, COUNT(*)::bigint AS count
                FROM expanded
                WHERE COALESCE(status_blob->>'status', status_blob#>>'{}', '') NOT ILIKE '%removed%'
                GROUP BY label
                ORDER BY count DESC
                LIMIT %s
                """,
                (limit,),
            )
            return [{'label': r['label'], 'count': int(r['count'])} for r in cur.fetchall()]
    except Exception as e:
        logger.warning('get_top_labels failed: %s', e)
        return []


def get_recent_label_mutations(limit: int = 25) -> List[Dict[str, Any]]:
    """The example labels service does not record a per-mutation history table,
    so we surface the most recent rows in entity_labels as a best-effort proxy.
    """
    if not table_exists('entity_labels'):
        return []
    try:
        with get_dict_cursor() as cur:
            cur.execute(
                """
                SELECT entity_key, labels
                FROM entity_labels
                LIMIT %s
                """,
                (limit,),
            )
            mutations: List[Dict[str, Any]] = []
            for row in cur.fetchall():
                labels_blob = row['labels'] or {}
                if not isinstance(labels_blob, dict):
                    continue
                for label_name, status in labels_blob.items():
                    status_value: Any = status
                    if isinstance(status, dict):
                        status_value = status.get('status') or status.get('state')
                    mutations.append(
                        {
                            'entity_key': row['entity_key'],
                            'label': str(label_name),
                            'status': str(status_value) if status_value is not None else None,
                            'timestamp': None,
                        }
                    )
                    if len(mutations) >= limit:
                        break
                if len(mutations) >= limit:
                    break
            return mutations
    except Exception as e:
        logger.warning('get_recent_label_mutations failed: %s', e)
        return []
