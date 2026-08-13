"""event creation revamp: cover image, online events, single category,
simplified community join/frequency options

Revision ID: a1b2c3d4e5f6
Revises: 1fbc51a3a8a8
Create Date: 2026-08-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '1fbc51a3a8a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('events', sa.Column('cover_image_url', sa.String(length=255), nullable=True))
    op.add_column(
        'events',
        sa.Column('is_online', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )

    # Data backfill before dropping the old vocabulary — frequency's
    # weekly/biweekly/monthly collapse into the new
    # daily/twice_a_week/once_a_week/irregular set (see FREQUENCY_OPTIONS in
    # app/schemas/event.py), and join_policy's open/invite_only/closed
    # collapse into anyone/admin_approval (see JOIN_POLICY_OPTIONS). No
    # DB-level CHECK constraint exists for either — both are plain strings
    # validated at the Pydantic layer only — so this is just a data UPDATE.
    op.execute(
        """
        UPDATE events SET frequency = CASE frequency
            WHEN 'weekly' THEN 'once_a_week'
            WHEN 'biweekly' THEN 'irregular'
            WHEN 'monthly' THEN 'irregular'
            ELSE frequency
        END
        WHERE frequency IS NOT NULL
        """
    )
    op.execute(
        """
        UPDATE events SET join_policy = CASE join_policy
            WHEN 'open' THEN 'anyone'
            WHEN 'invite_only' THEN 'admin_approval'
            WHEN 'closed' THEN 'admin_approval'
            ELSE join_policy
        END
        """
    )
    # Events are flyer/poster-style now (no join mechanism) — force every
    # existing event row to the only value EventCreate will ever send.
    op.execute("UPDATE events SET join_policy = 'anyone' WHERE kind = 'event'")

    op.drop_column('events', 'community_vibe')
    op.drop_column('events', 'skill_level')
    op.drop_column('events', 'event_style')

    op.alter_column('events', 'join_policy', server_default='anyone')


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('events', 'join_policy', server_default='open')

    op.add_column('events', sa.Column('event_style', sa.String(length=50), nullable=True))
    op.add_column('events', sa.Column('skill_level', sa.String(length=50), nullable=True))
    op.add_column('events', sa.Column('community_vibe', sa.String(length=50), nullable=True))

    op.execute(
        """
        UPDATE events SET join_policy = CASE join_policy
            WHEN 'anyone' THEN 'open'
            WHEN 'admin_approval' THEN 'invite_only'
            ELSE join_policy
        END
        """
    )
    op.execute(
        """
        UPDATE events SET frequency = CASE frequency
            WHEN 'once_a_week' THEN 'weekly'
            WHEN 'twice_a_week' THEN 'weekly'
            WHEN 'irregular' THEN 'monthly'
            ELSE frequency
        END
        WHERE frequency IS NOT NULL
        """
    )

    op.drop_column('events', 'is_online')
    op.drop_column('events', 'cover_image_url')
