"""add events.allow_dms (organiser can opt out of 'Message organiser')

Revision ID: c5e6f7a8b9d1
Revises: b4d5e6f7a8c0
Create Date: 2026-11-08 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'c5e6f7a8b9d1'
down_revision: Union[str, Sequence[str], None] = 'b4d5e6f7a8c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("events", sa.Column("allow_dms", sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade() -> None:
    op.drop_column("events", "allow_dms")
