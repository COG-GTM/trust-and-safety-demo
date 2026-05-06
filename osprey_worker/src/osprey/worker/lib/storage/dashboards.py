"""SQLAlchemy model for persisted analytics dashboards.

Dashboards store their full layout (widget positions, sizes, types and per-widget
configuration) as a single JSONB blob. This keeps the schema stable as new widget
types are added on the frontend.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from osprey.worker.lib.snowflake import Snowflake, generate_snowflake
from sqlalchemy import BigInteger, Boolean, Column, DateTime, Text, func
from sqlalchemy.dialects.postgresql import JSONB

from .postgres import Model, scoped_session


class Dashboard(Model):
    __tablename__ = 'dashboards'

    id = Column(BigInteger, primary_key=True)
    name = Column(Text, nullable=False)
    owner = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    layout_json = Column(JSONB, nullable=False, default=dict)
    is_template = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    def __repr__(self) -> str:
        return f'<Dashboard(id={self.id}, name={self.name}, owner={self.owner})>'

    @classmethod
    def get_one_with_id(cls, dashboard_id: int) -> Optional['Dashboard']:
        with scoped_session() as session:
            return session.query(cls).filter(cls.id == dashboard_id).limit(1).first()

    @classmethod
    def get_all(cls, limit: int = 200) -> List['Dashboard']:
        with scoped_session() as session:
            return session.query(cls).order_by(cls.id.desc()).limit(limit).all()

    @classmethod
    def get_all_for_user(cls, user_email: str, limit: int = 200) -> List['Dashboard']:
        with scoped_session() as session:
            return session.query(cls).filter(cls.owner == user_email).order_by(cls.id.desc()).limit(limit).all()

    def insert(self, commit: bool = True) -> None:
        if self.id:
            raise RuntimeError('Cannot insert existing row')

        with scoped_session(commit=commit) as session:
            self.id = generate_snowflake().to_int()
            session.add(self)

    def save(self) -> None:
        with scoped_session(commit=True) as session:
            session.add(self)

    def delete(self) -> None:
        with scoped_session(commit=True) as session:
            session.delete(self)

    def serialize(self) -> Dict[str, Any]:
        assert self.id is not None
        return {
            'id': str(self.id),
            'name': self.name,
            'owner': self.owner,
            'description': self.description,
            'layout_json': self.layout_json or {},
            'is_template': bool(self.is_template),
            'created_at': _datetime_to_iso(self.created_at) or Snowflake(self.id).to_datetime().isoformat(),
            'updated_at': _datetime_to_iso(self.updated_at) or Snowflake(self.id).to_datetime().isoformat(),
        }


def _datetime_to_iso(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    return value.isoformat()
