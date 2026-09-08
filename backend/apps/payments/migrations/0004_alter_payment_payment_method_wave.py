from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("payments", "0003_payment_member_nullable"),
    ]

    operations = [
        migrations.AlterField(
            model_name="payment",
            name="payment_method",
            field=models.CharField(
                choices=[
                    ("MANUAL", "Manuel"),
                    ("CASH", "Especes"),
                    ("CHECK", "Cheque"),
                    ("OTHER", "Autre"),
                    ("EXTERNAL_MOBILE_MONEY", "Mobile Money externe"),
                    ("MOBILE_MONEY", "Mobile Money"),
                    ("WAVE", "Wave"),
                    ("CARD", "Carte bancaire"),
                    ("AGGREGATOR", "Agregateur"),
                    ("BANK_TRANSFER", "Virement"),
                ],
                default="MANUAL",
                max_length=64,
            ),
        ),
    ]
