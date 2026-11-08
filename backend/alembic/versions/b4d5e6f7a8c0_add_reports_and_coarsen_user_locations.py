"""add reports; round stored user locations to ~1 km

Revision ID: b4d5e6f7a8c0
Revises: a3c4d5e6f7b9
Create Date: 2026-11-07 18:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'b4d5e6f7a8c0'
down_revision: Union[str, Sequence[str], None] = 'a3c4d5e6f7b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('reporter_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('target_type', sa.String(length=10), nullable=False),
        sa.Column('target_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('reason', sa.String(length=20), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=10), server_default='open', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['reporter_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('reporter_id', 'target_type', 'target_id', name='uq_reports_reporter_target'),
    )
    op.create_index('ix_reports_reporter_id', 'reports', ['reporter_id'])
    op.create_index('ix_reports_target_id', 'reports', ['target_id'])

    # Existing users were stored at full precision; coarsen them (2 dp ~ 1.1 km).
    op.execute(
        "UPDATE users SET location_lat = ROUND(location_lat::numeric, 2)::float8, "
        "location_lng = ROUND(location_lng::numeric, 2)::float8 "
        "WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL"
    )


def downgrade() -> None:
    # The rounding is lossy and cannot be undone; only the table is dropped.
    op.drop_index('ix_reports_target_id', table_name='reports')
    op.drop_index('ix_reports_reporter_id', table_name='reports')
    op.drop_table('reports')
