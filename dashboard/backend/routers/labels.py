"""Label analytics endpoints — backed by the Postgres ``entity_labels`` table."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from ..config import Settings, get_settings
from ..models import LabelEntityRow, LabelStatsResponse
from ..models.schemas import LabelDistributionRow

router = APIRouter(prefix='/labels', tags=['labels'])


@router.get('/stats', response_model=LabelStatsResponse)
async def label_stats(
    request: Request,
    recent_hours: int = Query(default=24, ge=1, le=24 * 30),
    expiring_hours: int = Query(default=24, ge=1, le=24 * 30),
    top_entities_limit: int = Query(default=25, ge=1, le=200),
    settings: Settings = Depends(get_settings),  # noqa: B008
) -> LabelStatsResponse:
    labels_db = request.app.state.labels_db

    distribution = labels_db.label_distribution() if labels_db else []
    recently_applied = labels_db.recently_applied(hours=recent_hours) if labels_db else []
    expiring = labels_db.expiring_soon(hours=expiring_hours) if labels_db else []
    top_entities = labels_db.top_entities(limit=top_entities_limit) if labels_db else []
    total_entities = labels_db.total_labeled_entities() if labels_db else 0

    return LabelStatsResponse(
        total_labeled_entities=total_entities,
        distribution=[LabelDistributionRow(**row) for row in distribution],
        recently_applied=[LabelDistributionRow(**row) for row in recently_applied],
        expiring_soon=[LabelDistributionRow(**row) for row in expiring],
        top_entities=[LabelEntityRow(**row) for row in top_entities],
    )
