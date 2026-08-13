"""communities: link each community to a ChatGroup for membership/chat

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-14 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('events', sa.Column('group_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'events_group_id_fkey',
        'events',
        'chat_groups',
        ['group_id'],
        ['id'],
        ondelete='SET NULL',
    )
    # No backfill for existing community rows — join_community lazily
    # creates the linked group for any row still missing one (see
    # _create_community_group in routes/events.py), so this migration
    # doesn't need to generate ChatGroup rows itself.


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('events_group_id_fkey', 'events', type_='foreignkey')
    op.drop_column('events', 'group_id')
