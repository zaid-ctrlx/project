"""add email_otps table for email verification and password reset

Revision ID: c4e8f1a2b3d5
Revises: a7c1d9e04b52
Create Date: 2026-11-03 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'c4e8f1a2b3d5'
down_revision: Union[str, Sequence[str], None] = 'a7c1d9e04b52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'email_otps',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('purpose', sa.String(length=20), nullable=False),
        sa.Column('code_hash', sa.String(length=64), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'purpose', name='uq_email_otps_user_purpose'),
    )
    op.create_index(op.f('ix_email_otps_user_id'), 'email_otps', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_email_otps_user_id'), table_name='email_otps')
    op.drop_table('email_otps')
