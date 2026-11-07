"""add interactions log for the recommender

Revision ID: f2b3c4d5e6a8
Revises: e1a2b3c4d5f7
Create Date: 2026-11-07 10:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'f2b3c4d5e6a8'
down_revision: Union[str, Sequence[str], None] = 'e1a2b3c4d5f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'interactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('kind', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_interactions_event_id', 'interactions', ['event_id'])
    op.create_index('ix_interactions_user_created', 'interactions', ['user_id', 'created_at'])


def downgrade() -> None:
    op.drop_index('ix_interactions_user_created', table_name='interactions')
    op.drop_index('ix_interactions_event_id', table_name='interactions')
    op.drop_table('interactions')
