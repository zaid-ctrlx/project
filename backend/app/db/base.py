# Imported by Alembic's env.py so autogenerate can see every model.
# Add new model modules here as they're created.

from app.db.base_class import Base  # noqa: F401
from app.models.user import Tag, User  # noqa: F401
from app.models.event import Event  # noqa: F401
from app.models.message import DmClear, Message  # noqa: F401
from app.models.group import ChatGroup, GroupMember, GroupMessage  # noqa: F401
from app.models.block import UserBlock  # noqa: F401
