"""add connections table

Revision ID: d5f9a2b3c4e6
Revises: c4e8f1a2b3d5
Create Date: 2026-11-04 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'd5f9a2b3c4e6'
down_revision: Union[str, Sequence[str], None] = 'c4e8f1a2b3d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'connections',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('requester_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('addressee_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(length=10), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['requester_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['addressee_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('requester_id', 'addressee_id', name='uq_connections_requester_addressee'),
    )
    op.create_index(op.f('ix_connections_requester_id'), 'connections', ['requester_id'], unique=False)
    op.create_index(op.f('ix_connections_addressee_id'), 'connections', ['addressee_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_connections_addressee_id'), table_name='connections')
    op.drop_index(op.f('ix_connections_requester_id'), table_name='connections')
    op.drop_table('connections')
