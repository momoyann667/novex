from django.db import migrations, models
import django.db.models.deletion


def create_settings(apps, schema_editor):
    Workspace = apps.get_model("workspaces", "Workspace")
    WorkspaceSettings = apps.get_model("workspaces", "WorkspaceSettings")
    for workspace in Workspace.objects.all():
        WorkspaceSettings.objects.get_or_create(
            workspace=workspace,
            defaults={
                "money_format": {"thousand_separator": " ", "decimals": 0, "symbol_position": "after"},
                "finance_preferences": {"expense_validation_enabled": True, "income_validation_enabled": False},
                "contribution_preferences": {"periodicity": "MONTHLY", "due_day": 30, "reminders": ["before_due", "due_day", "after_due"]},
                "notification_preferences": {
                    "channels": {"in_app": True, "email": True, "sms": False, "whatsapp": False},
                    "topics": {"contributions": True, "payments": True, "events": True, "projects": True, "documents": True, "members": True, "reports": True, "security": True},
                },
                "member_preferences": {"manual_approval": True, "required_fields": ["first_name", "last_name", "email"]},
                "project_preferences": {"budget_alert_threshold": 80},
                "event_preferences": {"default_reminders": [1440, 60], "attendance_confirmation": True},
                "document_preferences": {"retention_months": 60, "sensitive_documents_require_review": True},
                "integration_states": {"payment": "connected", "email": "connected", "sms": "not_connected", "whatsapp": "not_connected"},
                "security_preferences": {"two_factor_available": False, "session_review_available": False},
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("workspaces", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="WorkspaceSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("acronym", models.CharField(blank=True, max_length=32)),
                ("registration_number", models.CharField(blank=True, max_length=80)),
                ("region", models.CharField(blank=True, max_length=120)),
                ("founded_on", models.DateField(blank=True, null=True)),
                ("primary_contact_name", models.CharField(blank=True, max_length=160)),
                ("primary_contact_email", models.EmailField(blank=True, max_length=254)),
                ("primary_contact_phone", models.CharField(blank=True, max_length=32)),
                ("primary_contact_function", models.CharField(blank=True, max_length=120)),
                ("timezone", models.CharField(default="Africa/Abidjan", max_length=64)),
                ("language", models.CharField(default="fr", max_length=8)),
                ("date_format", models.CharField(default="DD/MM/YYYY", max_length=24)),
                ("money_format", models.JSONField(blank=True, default=dict)),
                ("theme", models.CharField(default="light", max_length=16)),
                ("primary_color", models.CharField(default="#0F7FF2", max_length=16)),
                ("secondary_color", models.CharField(default="#3B82F6", max_length=16)),
                ("finance_preferences", models.JSONField(blank=True, default=dict)),
                ("contribution_preferences", models.JSONField(blank=True, default=dict)),
                ("notification_preferences", models.JSONField(blank=True, default=dict)),
                ("member_preferences", models.JSONField(blank=True, default=dict)),
                ("project_preferences", models.JSONField(blank=True, default=dict)),
                ("event_preferences", models.JSONField(blank=True, default=dict)),
                ("document_preferences", models.JSONField(blank=True, default=dict)),
                ("integration_states", models.JSONField(blank=True, default=dict)),
                ("security_preferences", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("workspace", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="settings", to="workspaces.workspace")),
            ],
        ),
        migrations.AddIndex(model_name="workspacesettings", index=models.Index(fields=["workspace"], name="workspaces__workspa_38b432_idx")),
        migrations.RunPython(create_settings, migrations.RunPython.noop),
    ]
