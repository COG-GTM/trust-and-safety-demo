"""GET /api/dashboard/labels/top — top labels and recent mutations."""

from __future__ import annotations

from fastapi import APIRouter, Query

from ..models.schemas import LabelMutation, LabelsResponse, TopLabel
from ..services import labels_service

router = APIRouter(prefix='/api/dashboard', tags=['labels'])


@router.get('/labels/top', response_model=LabelsResponse)
def top_labels(
    limit: int = Query(default=10, ge=1, le=200),
    mutations_limit: int = Query(default=25, ge=1, le=200),
) -> LabelsResponse:
    return LabelsResponse(
        top=[TopLabel(**row) for row in labels_service.get_top_labels(limit=limit)],
        recent_mutations=[
            LabelMutation(**row) for row in labels_service.get_recent_label_mutations(limit=mutations_limit)
        ],
    )
