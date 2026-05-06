from datetime import datetime
from typing import Any, Dict, List, Optional

from osprey.worker.lib.snowflake import Snowflake, generate_snowflake
from sqlalchemy import BigInteger, Column, DateTime, Text, func
from sqlalchemy.dialects.postgresql import JSONB

from .postgres import Model, scoped_session


class Dashboard(Model):
    """A user-saved dashboard layout containing analytics widgets.

    The ``layout_json`` column stores the React-grid-layout positions and the
    per-widget config blobs as a single JSONB document, keeping the schema
    flexible while widget types evolve.
    """

    __tablename__ = 'dashboards'

    id = Column(BigInteger, primary_key=True)
    name = Column(Text, nullable=False)
    created_by = Column(Text, nullable=False)
    layout_json = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f'<Dashboard(id={self.id}, name={self.name})>'

    @classmethod
    def get_one_with_id(cls, dashboard_id: int) -> Optional['Dashboard']:
        with scoped_session() as session:
            return session.query(cls).filter(cls.id == dashboard_id).limit(1).first()

    @classmethod
    def get_all(cls, created_by: Optional[str] = None, limit: int = 100) -> List['Dashboard']:
        with scoped_session() as session:
            query = session.query(cls)
            if created_by is not None:
                query = query.filter(cls.created_by == created_by)
            return query.order_by(cls.id.desc()).limit(limit).all()

    def insert(self, commit: bool = True) -> None:
        if self.id:
            raise RuntimeError('Cannot insert existing row')
        with scoped_session(commit=commit) as session:
            self.id = generate_snowflake().to_int()
            session.add(self)

    def save(self, commit: bool = True) -> None:
        with scoped_session(commit=commit) as session:
            session.merge(self)

    def delete(self, commit: bool = True) -> None:
        with scoped_session(commit=commit) as session:
            session.query(Dashboard).filter(Dashboard.id == self.id).delete()

    def serialize(self) -> Dict[str, Any]:
        assert self.id is not None
        return {
            'id': str(self.id),
            'name': self.name,
            'created_by': self.created_by,
            'layout_json': self.layout_json or {},
            'created_at': _iso(self.created_at),
            'updated_at': _iso(self.updated_at),
        }


def _iso(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    return value.isoformat()


__all__ = ['Dashboard', 'Snowflake']
