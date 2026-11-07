# Imported by Alembic's env.py so autogenerate can see every model.
# Add new model modules here as they're created.

from app.db.base_class import Base  # noqa: F401
from app.models.user import Tag, User  # noqa: F401
from app.models.event import Event  # noqa: F401
from app.models.message import DmClear, DmMute, Message, MessageReaction  # noqa: F401
from app.models.group import ChatGroup, GroupMember, GroupMessage, GroupMessageReaction  # noqa: F401
from app.models.block import UserBlock  # noqa: F401
from app.models.notification import Notification, PushToken  # noqa: F401
from app.models.join_request import JoinRequest  # noqa: F401
from app.models.email_otp import EmailOtp  # noqa: F401
from app.models.connection import Connection  # noqa: F401
from app.models.interaction import Interaction  # noqa: F401
from app.models.event_reminder import EventReminder  # noqa: F401
