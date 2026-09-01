from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("workspaces", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="AIConversation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=180)),
                ("module", models.CharField(blank=True, max_length=80)),
                ("summary", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="ai_conversations", to=settings.AUTH_USER_MODEL)),
                ("workspace", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="ai_conversations", to="workspaces.workspace")),
            ],
        ),
        migrations.CreateModel(
            name="AIMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(choices=[("user", "Utilisateur"), ("assistant", "Assistant"), ("system", "Systeme"), ("tool", "Outil")], max_length=16)),
                ("content", models.TextField()),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("conversation", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="messages", to="ai_assistant.aiconversation")),
                ("workspace", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="ai_messages", to="workspaces.workspace")),
            ],
        ),
        migrations.CreateModel(
            name="AIUsageLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("provider", models.CharField(default="local", max_length=40)),
                ("model", models.CharField(blank=True, max_length=80)),
                ("request_count", models.PositiveIntegerField(default=1)),
                ("prompt_tokens", models.PositiveIntegerField(default=0)),
                ("completion_tokens", models.PositiveIntegerField(default=0)),
                ("estimated_cost", models.DecimalField(decimal_places=6, default=0, max_digits=12)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("conversation", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="usage_logs", to="ai_assistant.aiconversation")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="ai_usage_logs", to=settings.AUTH_USER_MODEL)),
                ("workspace", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="ai_usage_logs", to="workspaces.workspace")),
            ],
        ),
        migrations.AddIndex(model_name="aiconversation", index=models.Index(fields=["workspace", "user", "-updated_at"], name="ai_assistan_workspa_a1c2bd_idx")),
        migrations.AddIndex(model_name="aiconversation", index=models.Index(fields=["workspace", "-created_at"], name="ai_assistan_workspa_828ac4_idx")),
        migrations.AddIndex(model_name="aimessage", index=models.Index(fields=["workspace", "conversation", "created_at"], name="ai_assistan_workspa_a0c935_idx")),
        migrations.AddIndex(model_name="aimessage", index=models.Index(fields=["workspace", "role", "-created_at"], name="ai_assistan_workspa_b4c9a4_idx")),
        migrations.AddIndex(model_name="aiusagelog", index=models.Index(fields=["workspace", "user", "-created_at"], name="ai_assistan_workspa_600095_idx")),
        migrations.AddIndex(model_name="aiusagelog", index=models.Index(fields=["workspace", "-created_at"], name="ai_assistan_workspa_9290f6_idx")),
    ]
