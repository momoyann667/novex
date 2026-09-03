from django.core.management.base import BaseCommand

from apps.subscriptions.services import expire_due_trials, send_due_trial_warnings


class Command(BaseCommand):
    help = "Expire les Freemium arrives a echeance et envoie les alertes d'essai."

    def handle(self, *args, **options):
        expired = expire_due_trials()
        warnings = send_due_trial_warnings()
        self.stdout.write(self.style.SUCCESS(f"Trials expires: {expired}. Alertes envoyees: {warnings}."))
