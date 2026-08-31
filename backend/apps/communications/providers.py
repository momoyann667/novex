from dataclasses import dataclass

from .models import CommunicationChannel, CommunicationRecipientStatus


@dataclass
class ChannelResult:
    status: str
    provider_message_id: str = ""
    failure_reason: str = ""


class NotificationChannel:
    channel = ""

    def validate(self, recipient) -> tuple[bool, str]:
        return False, "Canal non configure pour ce workspace."

    def send(self, communication, recipient) -> ChannelResult:
        valid, reason = self.validate(recipient)
        if not valid:
            return ChannelResult(status=CommunicationRecipientStatus.FAILED, failure_reason=reason)
        return ChannelResult(status=CommunicationRecipientStatus.SENT, provider_message_id=f"local-{recipient.id}")

    def get_status(self, recipient) -> str:
        return recipient.status


class InAppChannel(NotificationChannel):
    channel = CommunicationChannel.IN_APP

    def validate(self, recipient) -> tuple[bool, str]:
        if not recipient.member_id and not recipient.user_id:
            return False, "Destinataire in-app introuvable."
        return True, ""

    def send(self, communication, recipient) -> ChannelResult:
        return ChannelResult(status=CommunicationRecipientStatus.DELIVERED, provider_message_id=f"in-app-{recipient.id}")


class UnconfiguredChannel(NotificationChannel):
    def __init__(self, channel: str):
        self.channel = channel

    def validate(self, recipient) -> tuple[bool, str]:
        return False, f"{self.channel} non configure pour cette association."


def channel_for(channel: str) -> NotificationChannel:
    if channel == CommunicationChannel.IN_APP:
        return InAppChannel()
    return UnconfiguredChannel(channel)
