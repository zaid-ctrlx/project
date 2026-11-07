"""add event_reminders ledger

Revision ID: a3c4d5e6f7b9
Revises: f2b3c4d5e6a8
Create Date: 2026-11-07 14:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'a3c4d5e6f7b9'
down_revision: Union[str, Sequence[str], None] = 'f2b3c4d5e6a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'event_reminders',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('kind', sa.String(length=10), nullable=False),
        sa.Column('sent_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('event_id', 'user_id', 'kind', name='uq_event_reminders_event_user_kind'),
    )
    op.create_index('ix_event_reminders_event_id', 'event_reminders', ['event_id'])


def downgrade() -> None:
    op.drop_index('ix_event_reminders_event_id', table_name='event_reminders')
    op.drop_table('event_reminders')
