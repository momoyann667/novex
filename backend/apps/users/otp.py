import json
import secrets
import urllib.error
import urllib.request
from datetime import timedelta
from hashlib import sha256

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac

from .models import UserOTPVerification


class OTPError(Exception):
    pass


def client_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "unknown")


def check_otp_rate_limit(*, email: str, request, action: str):
    email_key = sha256(email.lower().encode("utf-8")).hexdigest()
    ip_key = sha256(client_ip(request).encode("utf-8")).hexdigest()
    limits = [
        (f"otp:{action}:email:{email_key}", 3, 15 * 60),
        (f"otp:{action}:ip:{ip_key}", 10, 15 * 60),
    ]
    for key, max_attempts, ttl in limits:
        count = cache.get(key, 0) + 1
        cache.set(key, count, ttl)
        if count > max_attempts:
            raise OTPError("Trop de tentatives OTP. Reessaie dans quelques minutes.")


def otp_hash(code: str) -> str:
    return salted_hmac("novex.user.otp", code).hexdigest()


def generate_otp_code() -> str:
    test_code = getattr(settings, "ZAVUDEV_OTP_TEST_CODE", "")
    if test_code:
        return test_code
    return f"{secrets.randbelow(1_000_000):06d}"


def send_zavu_otp(*, destination: str, code: str, channel: str) -> str:
    api_key = getattr(settings, "ZAVUDEV_API_KEY", "")
    if not api_key:
        return "zavu-dev-disabled"

    payload = {
        "to": destination,
        "channel": channel,
        "subject": "Code de verification NOVEX",
        "text": f"Votre code de verification NOVEX est {code}. Il expire dans {settings.ZAVUDEV_OTP_EXPIRY_MINUTES} minutes.",
    }
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{settings.ZAVUDEV_API_URL.rstrip('/')}/messages",
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    if getattr(settings, "ZAVUDEV_OTP_SENDER", ""):
        request.add_header("Zavu-Sender", settings.ZAVUDEV_OTP_SENDER)

    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            body = json.loads(response.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as exc:
        detail = _zavu_error_detail(exc)
        raise OTPError(detail) from exc
    except urllib.error.URLError as exc:
        raise OTPError("Impossible d'envoyer le code OTP pour le moment.") from exc

    message = body.get("message") if isinstance(body, dict) else None
    return str((message or {}).get("id") or body.get("id") or "")


def _zavu_error_detail(exc: urllib.error.HTTPError) -> str:
    try:
        raw_body = exc.read().decode("utf-8")
        payload = json.loads(raw_body) if raw_body else {}
    except (UnicodeDecodeError, json.JSONDecodeError):
        payload = {}

    message = ""
    if isinstance(payload, dict):
        for key in ("message", "error", "detail"):
            value = payload.get(key)
            if isinstance(value, str):
                message = value
                break

    if exc.code in {401, 403}:
        return "Zavu refuse la cle API. Verifie ZAVUDEV_API_KEY dans .env.local."
    if exc.code == 400 and "Channel 'sms' is not available" in message:
        return "Ton sender Zavu est probablement en SMS one way. Mets ZAVUDEV_OTP_CHANNEL=sms_oneway dans .env.local puis redemarre Django."
    if exc.code == 400 and message:
        return f"Zavu refuse l'envoi OTP: {message}"
    if exc.code == 400:
        return "Zavu refuse l'envoi OTP. Verifie que le numero est au format +2250700000000."
    if exc.code == 429:
        return "Trop de demandes OTP cote Zavu. Reessaie dans quelques minutes."
    return "Impossible d'envoyer le code OTP pour le moment."


def create_registration_otp(user):
    code = generate_otp_code()
    channel = getattr(settings, "ZAVUDEV_OTP_CHANNEL", "sms_oneway")
    destination = user.email if channel == UserOTPVerification.Channel.EMAIL else user.phone
    if not destination:
        raise OTPError("Aucune destination disponible pour envoyer le code OTP.")

    UserOTPVerification.objects.filter(user=user, purpose=UserOTPVerification.Purpose.REGISTRATION, verified_at__isnull=True).update(
        expires_at=timezone.now()
    )
    otp = UserOTPVerification.objects.create(
        user=user,
        purpose=UserOTPVerification.Purpose.REGISTRATION,
        channel=channel,
        destination=destination,
        code_hash=otp_hash(code),
        expires_at=timezone.now() + timedelta(minutes=settings.ZAVUDEV_OTP_EXPIRY_MINUTES),
    )
    otp.zavu_message_id = send_zavu_otp(destination=destination, code=code, channel=channel)
    otp.save(update_fields=["zavu_message_id"])
    return otp


def verify_registration_otp(*, user, code: str):
    otp = (
        UserOTPVerification.objects.filter(user=user, purpose=UserOTPVerification.Purpose.REGISTRATION, verified_at__isnull=True)
        .order_by("-created_at")
        .first()
    )
    if not otp:
        raise OTPError("Aucun code OTP actif pour ce compte.")
    if otp.is_expired:
        raise OTPError("Ce code OTP a expire. Demande un nouveau code.")
    if otp.attempts >= otp.max_attempts:
        raise OTPError("Nombre d'essais depasse. Demande un nouveau code.")

    otp.attempts += 1
    if not constant_time_compare(otp.code_hash, otp_hash(code)):
        otp.save(update_fields=["attempts"])
        raise OTPError("Code OTP incorrect.")

    otp.verified_at = timezone.now()
    otp.save(update_fields=["attempts", "verified_at"])
    user.email_verified_at = timezone.now()
    user.save(update_fields=["email_verified_at"])
    return user
