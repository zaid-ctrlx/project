"""add kind and frequency to events

Revision ID: e7d9e8843c57
Revises: 1c85fb6cd6f5
Create Date: 2026-08-12 00:04:40.929847

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7d9e8843c57'
down_revision: Union[str, Sequence[str], None] = '1c85fb6cd6f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('events', sa.Column('kind', sa.String(length=20), server_default='event', nullable=False))
    op.add_column('events', sa.Column('frequency', sa.String(length=20), nullable=True))
    # Existing rows are all kind="event" (the server_default above) and
    # already have starts_at set, so relaxing this to nullable is safe —
    # only new kind="community" rows will actually have a null here.
    op.alter_column('events', 'starts_at', existing_type=sa.DateTime(timezone=True), nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('events', 'starts_at', existing_type=sa.DateTime(timezone=True), nullable=False)
    op.drop_column('events', 'frequency')
    op.drop_column('events', 'kind')
