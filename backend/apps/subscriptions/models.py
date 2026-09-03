from django.db import models

from apps.workspaces.models import Workspace


class Plan(models.Model):
    class Code(models.TextChoices):
        FREEMIUM = "FREEMIUM", "Freemium"
        NOVEX_START = "NOVEX_START", "NOVEX Start"
        NOVEX_PRO = "NOVEX_PRO", "NOVEX Pro"

    code = models.CharField(max_length=32, choices=Code.choices, unique=True)
    name = models.CharField(max_length=120)
    price = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default="XOF")
    billing_period = models.CharField(max_length=24, default="month")
    limits = models.JSONField(default=dict, blank=True)
    entitlements = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)


class Subscription(models.Model):
    class Status(models.TextChoices):
        TRIAL = "trial", "Trial"
        ACTIVE = "active", "Active"
        PAST_DUE = "past_due", "Past due"
        EXPIRED = "expired", "Expired"
        SUSPENDED = "suspended", "Suspended"
        CANCELLED = "cancelled", "Cancelled"

    workspace = models.OneToOneField(Workspace, on_delete=models.CASCADE, related_name="subscription")
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT)
    status = models.CharField(max_length=20, choices=Status.choices)
    trial_started_at = models.DateTimeField(null=True, blank=True)
    trial_ends_at = models.DateTimeField(null=True, blank=True)
    current_period_started_at = models.DateTimeField(null=True, blank=True)
    current_period_ends_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
