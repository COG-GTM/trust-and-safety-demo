"""Thin Druid client used by the dashboard.

We deliberately avoid pulling in ``pydruid`` (used by the existing UI API) so
this subproject stays lean. Druid's HTTP API is straightforward enough to
target with a few hand-written queries.

All queries target the ``osprey.execution_results`` datasource which is fed
from the ``KafkaOutputSink`` (see
``osprey_worker/src/osprey/worker/sinks/sink/kafka_output_sink.py``).
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx

from ..config import Settings

logger = logging.getLogger(__name__)


# Druid columns produced by the JSON ingestion spec
# (see druid/specs/execution_results.json + sample_execution_results.json):
#   __time            ISO timestamp
#   __action_id       numeric action id
#   __error_count     number of errors raised by SML evaluation
#   ActionName        action name (eg create_post, login)
#   __verdicts        multi-value of verdict effect names (NULL when no verdict)
#   __rules_fired     multi-value of rule names that evaluated to True
#   <feature names>   per-action extracted features
COL_TIME = '__time'
COL_ACTION_ID = '__action_id'
COL_ACTION_NAME = 'ActionName'
COL_ERROR_COUNT = '__error_count'
COL_VERDICTS = '__verdicts'
COL_RULES_FIRED = '__rules_fired'


class DruidClient:
    """Async Druid query client."""

    def __init__(self, settings: Settings, client: Optional[httpx.AsyncClient] = None) -> None:
        self._settings = settings
        self._client = client or httpx.AsyncClient(timeout=httpx.Timeout(15.0))

    async def aclose(self) -> None:
        await self._client.aclose()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def interval(start: datetime, end: datetime) -> str:
        return f'{start.astimezone(timezone.utc).isoformat()}/{end.astimezone(timezone.utc).isoformat()}'

    @staticmethod
    def default_window(lookback_hours: int) -> tuple[datetime, datetime]:
        end = datetime.now(tz=timezone.utc)
        start = end - timedelta(hours=lookback_hours)
        return start, end

    async def _execute(self, query: Dict[str, Any]) -> List[Dict[str, Any]]:
        url = f'{self._settings.druid_url.rstrip("/")}/druid/v2/'
        query.setdefault('context', {}).setdefault('timeout', self._settings.druid_query_timeout_ms)
        try:
            response = await self._client.post(url, json=query)
            response.raise_for_status()
            data = response.json()
            if isinstance(data, list):
                return data
            return []
        except httpx.HTTPError as exc:
            logger.warning('Druid query failed: %s — query=%s', exc, query.get('queryType'))
            return []

    # ------------------------------------------------------------------
    # Public query helpers
    # ------------------------------------------------------------------

    async def total_event_count(self, start: datetime, end: datetime) -> int:
        query = {
            'queryType': 'timeseries',
            'dataSource': self._settings.druid_datasource,
            'intervals': [self.interval(start, end)],
            'granularity': 'all',
            'aggregations': [{'type': 'count', 'name': 'count'}],
        }
        rows = await self._execute(query)
        if not rows:
            return 0
        return int(rows[0].get('result', {}).get('count', 0))

    async def flagged_event_count(self, start: datetime, end: datetime) -> int:
        """Count rows where ``__verdicts`` is non-null (i.e. at least one verdict)."""
        query = {
            'queryType': 'timeseries',
            'dataSource': self._settings.druid_datasource,
            'intervals': [self.interval(start, end)],
            'granularity': 'all',
            'filter': {'type': 'not', 'field': {'type': 'null', 'column': COL_VERDICTS}},
            'aggregations': [{'type': 'count', 'name': 'count'}],
        }
        rows = await self._execute(query)
        if not rows:
            return 0
        return int(rows[0].get('result', {}).get('count', 0))

    async def error_event_count(self, start: datetime, end: datetime) -> int:
        query = {
            'queryType': 'timeseries',
            'dataSource': self._settings.druid_datasource,
            'intervals': [self.interval(start, end)],
            'granularity': 'all',
            'filter': {
                'type': 'bound',
                'dimension': COL_ERROR_COUNT,
                'lower': '1',
                'lowerStrict': False,
                'ordering': 'numeric',
            },
            'aggregations': [{'type': 'count', 'name': 'count'}],
        }
        rows = await self._execute(query)
        if not rows:
            return 0
        return int(rows[0].get('result', {}).get('count', 0))

    async def events_timeseries(
        self,
        start: datetime,
        end: datetime,
        granularity: str = 'hour',
        flagged_only: bool = False,
    ) -> List[Dict[str, Any]]:
        query: Dict[str, Any] = {
            'queryType': 'timeseries',
            'dataSource': self._settings.druid_datasource,
            'intervals': [self.interval(start, end)],
            'granularity': granularity,
            'aggregations': [{'type': 'count', 'name': 'count'}],
        }
        if flagged_only:
            query['filter'] = {
                'type': 'not',
                'field': {'type': 'null', 'column': COL_VERDICTS},
            }
        return await self._execute(query)

    async def top_n(
        self,
        dimension: str,
        start: datetime,
        end: datetime,
        threshold: int = 10,
        flagged_only: bool = False,
    ) -> List[Dict[str, Any]]:
        query: Dict[str, Any] = {
            'queryType': 'topN',
            'dataSource': self._settings.druid_datasource,
            'intervals': [self.interval(start, end)],
            'granularity': 'all',
            'dimension': dimension,
            'metric': 'count',
            'threshold': threshold,
            'aggregations': [{'type': 'count', 'name': 'count'}],
        }
        if flagged_only:
            query['filter'] = {
                'type': 'not',
                'field': {'type': 'null', 'column': COL_VERDICTS},
            }
        rows = await self._execute(query)
        if not rows:
            return []
        return list(rows[0].get('result', []))

    async def group_by_dimensions(
        self,
        dimensions: List[str],
        start: datetime,
        end: datetime,
        flagged_only: bool = False,
        granularity: str = 'all',
    ) -> List[Dict[str, Any]]:
        query: Dict[str, Any] = {
            'queryType': 'groupBy',
            'dataSource': self._settings.druid_datasource,
            'intervals': [self.interval(start, end)],
            'granularity': granularity,
            'dimensions': dimensions,
            'aggregations': [{'type': 'count', 'name': 'count'}],
            'limitSpec': {
                'type': 'default',
                'limit': 200,
                'columns': [{'dimension': 'count', 'direction': 'descending'}],
            },
        }
        if flagged_only:
            query['filter'] = {
                'type': 'not',
                'field': {'type': 'null', 'column': COL_VERDICTS},
            }
        return await self._execute(query)

    async def scan_recent_flagged(
        self,
        start: datetime,
        end: datetime,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        query = {
            'queryType': 'scan',
            'dataSource': self._settings.druid_datasource,
            'intervals': [self.interval(start, end)],
            'resultFormat': 'list',
            'order': 'descending',
            'limit': limit,
            'columns': [
                COL_TIME,
                COL_ACTION_ID,
                COL_ACTION_NAME,
                COL_VERDICTS,
                COL_RULES_FIRED,
                COL_ERROR_COUNT,
                'UserId',
            ],
            'filter': {'type': 'not', 'field': {'type': 'null', 'column': COL_VERDICTS}},
        }
        rows = await self._execute(query)
        events: List[Dict[str, Any]] = []
        for row in rows:
            for event in row.get('events', []):
                events.append(event)
        return events
