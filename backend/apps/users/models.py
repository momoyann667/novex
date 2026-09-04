from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=32, blank=True)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    terms_accepted_at = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120)
    avatar = models.ImageField(upload_to="profiles/", blank=True)
    locale = models.CharField(max_length=16, default="fr-CI")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


class UserOTPVerification(models.Model):
    class Purpose(models.TextChoices):
        REGISTRATION = "registration", "Inscription"

    class Channel(models.TextChoices):
        EMAIL = "email", "Email"
        SMS = "sms", "SMS"
        SMS_ONEWAY = "sms_oneway", "SMS one way"
        WHATSAPP = "whatsapp", "WhatsApp"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="otp_verifications")
    purpose = models.CharField(max_length=32, choices=Purpose.choices, default=Purpose.REGISTRATION)
    channel = models.CharField(max_length=24, choices=Channel.choices, default=Channel.EMAIL)
    destination = models.CharField(max_length=254)
    code_hash = models.CharField(max_length=96)
    zavu_message_id = models.CharField(max_length=120, blank=True)
    expires_at = models.DateTimeField()
    verified_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=5)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "purpose", "verified_at"], name="users_usero_user_id_206cb5_idx"),
            models.Index(fields=["destination", "purpose", "created_at"], name="users_usero_destina_f83448_idx"),
        ]

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at
