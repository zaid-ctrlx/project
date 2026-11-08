"""add users.is_admin (moderators who can review reports)

Revision ID: d6f7a8b9c0e2
Revises: c5e6f7a8b9d1
Create Date: 2026-11-08 15:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'd6f7a8b9c0e2'
down_revision: Union[str, Sequence[str], None] = 'c5e6f7a8b9d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("users", "is_admin")
