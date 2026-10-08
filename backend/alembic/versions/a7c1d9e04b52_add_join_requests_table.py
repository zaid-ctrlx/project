"""add join_requests table

Revision ID: a7c1d9e04b52
Revises: eaabaf306642
Create Date: 2026-10-08 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7c1d9e04b52'
down_revision: Union[str, Sequence[str], None] = 'eaabaf306642'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('join_requests',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('event_id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('status', sa.String(length=20), server_default='pending', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('event_id', 'user_id', name='uq_join_requests_event_user')
    )
    op.create_index(op.f('ix_join_requests_event_id'), 'join_requests', ['event_id'], unique=False)
    op.create_index(op.f('ix_join_requests_user_id'), 'join_requests', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_join_requests_user_id'), table_name='join_requests')
    op.drop_index(op.f('ix_join_requests_event_id'), table_name='join_requests')
    op.drop_table('join_requests')
