from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("documents", "0001_initial"),
        ("workspaces", "0002_workspacesettings"),
    ]

    operations = [
        migrations.CreateModel(
            name="SupportTicket",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("ticket_number", models.CharField(max_length=32, unique=True)),
                ("subject", models.CharField(max_length=180)),
                ("description", models.TextField()),
                ("category", models.CharField(choices=[("TECHNICAL", "Probleme technique"), ("ACCOUNT", "Compte"), ("SUBSCRIPTION", "Abonnement"), ("PAYMENT", "Paiement"), ("FEATURE", "Fonctionnalite"), ("QUESTION", "Question"), ("OTHER", "Autre")], default="OTHER", max_length=24)),
                ("status", models.CharField(choices=[("PENDING", "En attente"), ("IN_PROGRESS", "Pris en charge"), ("RESOLVED", "Regle")], default="PENDING", max_length=24)),
                ("taken_at", models.DateTimeField(blank=True, null=True)),
                ("resolved_at", models.DateTimeField(blank=True, null=True)),
                ("last_activity_at", models.DateTimeField(auto_now=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("attachments", models.ManyToManyField(blank=True, related_name="support_tickets", to="documents.document")),
                ("creator", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="support_tickets", to=settings.AUTH_USER_MODEL)),
                ("resolved_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="resolved_support_tickets", to=settings.AUTH_USER_MODEL)),
                ("taken_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="taken_support_tickets", to=settings.AUTH_USER_MODEL)),
                ("workspace", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="support_tickets", to="workspaces.workspace")),
            ],
        ),
        migrations.CreateModel(
            name="SupportTicketMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("body", models.TextField()),
                ("is_admin_reply", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("author", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="support_ticket_messages", to=settings.AUTH_USER_MODEL)),
                ("ticket", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="messages", to="support.supportticket")),
            ],
        ),
        migrations.AddIndex(model_name="supportticket", index=models.Index(fields=["ticket_number"], name="support_sup_ticket__4a7d4b_idx")),
        migrations.AddIndex(model_name="supportticket", index=models.Index(fields=["workspace", "-created_at"], name="support_sup_workspa_293e5c_idx")),
        migrations.AddIndex(model_name="supportticket", index=models.Index(fields=["creator", "-created_at"], name="support_sup_creator_1bad88_idx")),
        migrations.AddIndex(model_name="supportticket", index=models.Index(fields=["status", "-created_at"], name="support_sup_status_52a4ed_idx")),
        migrations.AddIndex(model_name="supportticket", index=models.Index(fields=["last_activity_at"], name="support_sup_last_ac_1e3225_idx")),
        migrations.AddIndex(model_name="supportticketmessage", index=models.Index(fields=["ticket", "created_at"], name="support_sup_ticket__86cbdc_idx")),
    ]
