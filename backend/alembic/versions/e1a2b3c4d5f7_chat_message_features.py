"""chat message features: kind, edit/delete, forward, reply quote, reactions

Revision ID: e1a2b3c4d5f7
Revises: d5f9a2b3c4e6
Create Date: 2026-11-06 21:30:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'e1a2b3c4d5f7'
down_revision: Union[str, Sequence[str], None] = 'd5f9a2b3c4e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _add_message_columns(table: str) -> None:
    op.add_column(table, sa.Column('kind', sa.String(length=10), server_default='text', nullable=False))
    op.add_column(table, sa.Column('edited_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column(table, sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column(table, sa.Column('forwarded', sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column(table, sa.Column('reply_to_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column(table, sa.Column('quote_text', sa.Text(), nullable=True))
    op.add_column(table, sa.Column('quote_sender_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column(table, sa.Column('quote_kind', sa.String(length=10), nullable=True))
    op.create_foreign_key(f'fk_{table}_reply_to_id', table, table, ['reply_to_id'], ['id'], ondelete='SET NULL')


def _drop_message_columns(table: str) -> None:
    op.drop_constraint(f'fk_{table}_reply_to_id', table, type_='foreignkey')
    for col in ('quote_kind', 'quote_sender_id', 'quote_text', 'reply_to_id', 'forwarded', 'deleted_at', 'edited_at', 'kind'):
        op.drop_column(table, col)


def _create_reaction_table(name: str, parent: str, constraint: str) -> None:
    op.create_table(
        name,
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('message_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('emoji', sa.String(length=16), nullable=False),
        sa.ForeignKeyConstraint(['message_id'], [f'{parent}.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('message_id', 'user_id', name=constraint),
    )
    op.create_index(f'ix_{name}_message_id', name, ['message_id'])


def upgrade() -> None:
    _add_message_columns('messages')
    _add_message_columns('group_messages')
    _create_reaction_table('message_reactions', 'messages', 'uq_message_reactions_message_user')
    _create_reaction_table('group_message_reactions', 'group_messages', 'uq_group_message_reactions_message_user')


def downgrade() -> None:
    op.drop_table('group_message_reactions')
    op.drop_table('message_reactions')
    _drop_message_columns('group_messages')
    _drop_message_columns('messages')
