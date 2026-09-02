from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from apps.novex_admin.services import ensure_admin_rbac


class Command(BaseCommand):
    help = "Cree ou met a jour le compte administrateur interne NOVEX pour le developpement."

    def add_arguments(self, parser):
        parser.add_argument("--username", default="admin")
        parser.add_argument("--email", default="admin@novex.local")
        parser.add_argument("--password", default=None)

    def handle(self, *args, **options):
        password = options["password"]
        if password is None:
            if not settings.DEBUG:
                raise CommandError("En production, fournissez un mot de passe via --password ou un secret.")
            password = "1234567890"

        ensure_admin_rbac()
        User = get_user_model()
        user, created = User.objects.get_or_create(
            email=options["email"].lower(),
            defaults={"username": options["username"], "is_staff": True, "is_superuser": True},
        )
        user.username = options["username"]
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.set_password(password)
        user.save(update_fields=["username", "is_staff", "is_superuser", "is_active", "password"])
        status = "cree" if created else "mis a jour"
        self.stdout.write(self.style.SUCCESS(f"Compte Admin NOVEX {status}: {user.username}"))
