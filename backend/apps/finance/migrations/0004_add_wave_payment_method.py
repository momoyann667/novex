from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0003_financialtransaction_member_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="financialtransaction",
            name="payment_method",
            field=models.CharField(
                blank=True,
                choices=[
                    ("CASH", "Especes"),
                    ("MOBILE_MONEY", "Mobile Money"),
                    ("WAVE", "Wave"),
                    ("BANK_TRANSFER", "Virement"),
                    ("CARD", "Carte"),
                    ("OTHER", "Autre"),
                ],
                max_length=24,
            ),
        ),
    ]
