from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="financialtransaction",
            name="status",
            field=models.CharField(
                choices=[
                    ("DRAFT", "Brouillon"),
                    ("PENDING", "En attente"),
                    ("VALIDATED", "Validee"),
                    ("REJECTED", "Refusee"),
                    ("CANCELLED", "Annulee"),
                ],
                default="VALIDATED",
                max_length=16,
            ),
        ),
    ]
