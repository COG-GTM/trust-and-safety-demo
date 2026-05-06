import json
from datetime import datetime
from typing import Any
from unittest import mock

import pytest
from flask import Flask, Response, url_for
from flask.testing import FlaskClient
from osprey.worker.ui_api.osprey.lib.druid import (
    DimensionData,
    PeriodData,
    TopNPoPResponse,
)
from osprey.worker.ui_api.osprey.views.analytics import _topn_to_distribution

config = {
    'main.sml': '',
    'config.yaml': json.dumps(
        {
            'acl': {
                'users': {
                    'local-dev@localhost': {'abilities': [{'name': 'CAN_VIEW_EVENTS_BY_ACTION', 'allow_all': True}]}
                }
            }
        }
    ),
}

restricted_config = {
    'main.sml': '',
    'config.yaml': json.dumps(
        {
            'acl': {
                'users': {
                    'local-dev@localhost': {
                        'abilities': [
                            {
                                'name': 'CAN_VIEW_EVENTS_BY_ACTION',
                                'allow_specific': ['allowed_action'],
                            },
                        ]
                    },
                }
            }
        }
    ),
}


def _topn_payload(**overrides: Any) -> str:
    base = {
        'start': datetime(2024, 1, 1).isoformat(),
        'end': datetime(2024, 1, 2).isoformat(),
        'query_filter': '',
        'entity': None,
        'dimension': 'ActionName',
        'limit': 10,
    }
    base.update(overrides)
    return json.dumps(base)


def _timeseries_payload(**overrides: Any) -> str:
    base = {
        'start': datetime(2024, 1, 1).isoformat(),
        'end': datetime(2024, 1, 2).isoformat(),
        'query_filter': '',
        'entity': None,
        'granularity': 'hour',
    }
    base.update(overrides)
    return json.dumps(base)


def test_topn_to_distribution_handles_none() -> None:
    assert _topn_to_distribution('ActionName', None) == []


def test_topn_to_distribution_handles_empty_response() -> None:
    response = TopNPoPResponse(current_period=[], previous_period=None, comparison=None)
    assert _topn_to_distribution('ActionName', response) == []


def test_topn_to_distribution_aggregates_and_sorts() -> None:
    response = TopNPoPResponse(
        current_period=[
            PeriodData(
                timestamp='2024-01-01T00:00:00',
                result=[
                    DimensionData(ActionName='alpha', count=3),  # type: ignore[call-arg]
                    DimensionData(ActionName='beta', count=1),  # type: ignore[call-arg]
                ],
            ),
            PeriodData(
                timestamp='2024-01-01T01:00:00',
                result=[
                    DimensionData(ActionName='alpha', count=2),  # type: ignore[call-arg]
                    DimensionData(ActionName='gamma', count=4),  # type: ignore[call-arg]
                ],
            ),
        ],
        previous_period=None,
        comparison=None,
    )

    result = _topn_to_distribution('ActionName', response)

    assert result == [
        {'name': 'alpha', 'count': 5},
        {'name': 'gamma', 'count': 4},
        {'name': 'beta', 'count': 1},
    ]


def test_topn_to_distribution_skips_missing_dimension_values() -> None:
    response = TopNPoPResponse(
        current_period=[
            PeriodData(
                timestamp='2024-01-01T00:00:00',
                result=[
                    DimensionData(EffectName='ban', count=2),  # type: ignore[call-arg]
                    DimensionData(count=5),  # type: ignore[call-arg]
                ],
            ),
        ],
        previous_period=None,
        comparison=None,
    )

    assert _topn_to_distribution('EffectName', response) == [{'name': 'ban', 'count': 2}]


@pytest.mark.parametrize(
    'url',
    [
        'analytics.rule_distribution',
        'analytics.effects_breakdown',
        'analytics.kpi_summary',
    ],
)
def test_analytics_endpoints_require_ability(app: Flask, client: 'FlaskClient[Response]', url: str) -> None:
    payload = _timeseries_payload() if url == 'analytics.kpi_summary' else _topn_payload()
    res = client.post(url_for(url), content_type='application/json', data=payload)
    assert res.status_code == 401


@pytest.mark.use_rules_sources(config)
def test_rule_distribution_returns_aggregated_payload(app: Flask, client: 'FlaskClient[Response]') -> None:
    fake_response = TopNPoPResponse(
        current_period=[
            PeriodData(
                timestamp='2024-01-01T00:00:00',
                result=[
                    DimensionData(ActionName='login', count=10),  # type: ignore[call-arg]
                    DimensionData(ActionName='signup', count=4),  # type: ignore[call-arg]
                ],
            ),
        ],
        previous_period=None,
        comparison=None,
    )
    with mock.patch(
        'osprey.worker.ui_api.osprey.views.analytics.TopNDruidQuery.execute',
        return_value=fake_response,
    ) as execute_mock:
        res = client.post(
            url_for('analytics.rule_distribution'),
            content_type='application/json',
            data=_topn_payload(),
        )

    assert res.status_code == 200
    body = res.json
    assert body['dimension'] == 'ActionName'
    assert body['distribution'] == [
        {'name': 'login', 'count': 10},
        {'name': 'signup', 'count': 4},
    ]
    # Ensure query_filter_abilities was forwarded so per-user filtering applies
    assert execute_mock.call_count == 1
    _, kwargs = execute_mock.call_args
    assert kwargs.get('calculate_previous_period') is False
    assert 'query_filter_abilities' in kwargs
    assert len(kwargs['query_filter_abilities']) == 1


@pytest.mark.use_rules_sources(restricted_config)
def test_effects_breakdown_passes_restricted_ability(app: Flask, client: 'FlaskClient[Response]') -> None:
    fake_response = TopNPoPResponse(
        current_period=[
            PeriodData(
                timestamp='2024-01-01T00:00:00',
                result=[DimensionData(EffectName='ban', count=2)],  # type: ignore[call-arg]
            ),
        ],
        previous_period=None,
        comparison=None,
    )
    with mock.patch(
        'osprey.worker.ui_api.osprey.views.analytics.TopNDruidQuery.execute',
        return_value=fake_response,
    ) as execute_mock:
        res = client.post(
            url_for('analytics.effects_breakdown'),
            content_type='application/json',
            data=_topn_payload(dimension='EffectName'),
        )

    assert res.status_code == 200
    assert res.json['dimension'] == 'EffectName'
    _, kwargs = execute_mock.call_args
    abilities = kwargs.get('query_filter_abilities') or []
    assert len(abilities) == 1
    # The single forwarded ability should be the restricted CanViewEventsByAction
    assert abilities[0].name == 'CAN_VIEW_EVENTS_BY_ACTION'
    assert abilities[0].allow_specific == {'allowed_action'}


@pytest.mark.use_rules_sources(config)
def test_kpi_summary_aggregates_buckets(app: Flask, client: 'FlaskClient[Response]') -> None:
    raw_results = [
        {'timestamp': '2024-01-01T00:00:00', 'result': {'count': 12}},
        {'timestamp': '2024-01-01T01:00:00', 'result': {'count': 7}},
        {'timestamp': '2024-01-01T02:00:00', 'result': {}},
    ]
    with mock.patch(
        'osprey.worker.ui_api.osprey.views.analytics.TimeseriesDruidQuery.execute',
        return_value=raw_results,
    ):
        res = client.post(
            url_for('analytics.kpi_summary'),
            content_type='application/json',
            data=_timeseries_payload(),
        )

    assert res.status_code == 200
    body = res.json
    assert body['total_events'] == 19
    assert body['total_buckets'] == 3
    assert body['start'] == datetime(2024, 1, 1).isoformat()
    assert body['end'] == datetime(2024, 1, 2).isoformat()


@pytest.mark.use_rules_sources(config)
def test_kpi_summary_handles_empty_result(app: Flask, client: 'FlaskClient[Response]') -> None:
    with mock.patch(
        'osprey.worker.ui_api.osprey.views.analytics.TimeseriesDruidQuery.execute',
        return_value=None,
    ):
        res = client.post(
            url_for('analytics.kpi_summary'),
            content_type='application/json',
            data=_timeseries_payload(),
        )

    assert res.status_code == 200
    assert res.json == {
        'total_events': 0,
        'total_buckets': 0,
        'start': datetime(2024, 1, 1).isoformat(),
        'end': datetime(2024, 1, 2).isoformat(),
    }


@pytest.mark.use_rules_sources(config)
def test_rule_distribution_returns_400_on_value_error(app: Flask, client: 'FlaskClient[Response]') -> None:
    with mock.patch(
        'osprey.worker.ui_api.osprey.views.analytics.TopNDruidQuery.execute',
        side_effect=ValueError('Start date must be before end date'),
    ):
        res = client.post(
            url_for('analytics.rule_distribution'),
            content_type='application/json',
            data=_topn_payload(),
        )

    assert res.status_code == 400
    assert b'Start date must be before end date' in res.data
