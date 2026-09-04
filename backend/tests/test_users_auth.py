import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.users.models import Profile, UserOTPVerification


@pytest.mark.django_db
@override_settings(ZAVUDEV_API_KEY="", ZAVUDEV_OTP_CHANNEL="sms_oneway", ZAVUDEV_OTP_TEST_CODE="123456")
def test_register_creates_user_and_profile():
    cache.clear()
    api_client = APIClient()
    response = api_client.post(
        "/api/v1/auth/register/",
        {
            "first_name": "Jean",
            "last_name": "Dupont",
            "email": "JEAN@example.com",
            "phone": "+225 07 00 00 00 00",
            "password": "NovexPass123",
            "password_confirmation": "NovexPass123",
            "accepted_terms": True,
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.data["email"] == "jean@example.com"
    assert response.data["requires_otp"] is True
    assert response.data["otp_delivery"]["channel"] == "sms_oneway"
    assert response.data["otp_delivery"]["destination"] == "+2250700000000"
    user = get_user_model().objects.get(email="jean@example.com")
    assert user.phone == "+2250700000000"
    assert user.terms_accepted_at is not None
    assert user.email_verified_at is None
    assert Profile.objects.get(user=user).first_name == "Jean"
    assert UserOTPVerification.objects.filter(user=user, purpose="registration", verified_at__isnull=True).exists()


@pytest.mark.django_db
def test_register_rejects_existing_email():
    api_client = APIClient()
    get_user_model().objects.create_user(username="jean@example.com", email="jean@example.com", password="NovexPass123")

    response = api_client.post(
        "/api/v1/auth/register/",
        {
            "first_name": "Jean",
            "last_name": "Dupont",
            "email": "jean@example.com",
            "phone": "+2250700000000",
            "password": "NovexPass123",
            "password_confirmation": "NovexPass123",
            "accepted_terms": True,
        },
        format="json",
    )

    assert response.status_code == 400
    assert "email" in response.data


@pytest.mark.django_db
def test_login_authenticates_registered_user():
    api_client = APIClient()
    get_user_model().objects.create_user(
        username="jean@example.com",
        email="jean@example.com",
        password="NovexPass123",
        email_verified_at=timezone.now(),
    )

    response = api_client.post(
        "/api/v1/auth/login/",
        {
            "email": "JEAN@example.com",
            "password": "NovexPass123",
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.data["email"] == "jean@example.com"
    assert "sessionid" in response.cookies


@pytest.mark.django_db
def test_login_rejects_unverified_user():
    api_client = APIClient()
    get_user_model().objects.create_user(username="jean@example.com", email="jean@example.com", password="NovexPass123")

    response = api_client.post(
        "/api/v1/auth/login/",
        {
            "email": "jean@example.com",
            "password": "NovexPass123",
        },
        format="json",
    )

    assert response.status_code == 400
    assert "otp" in response.data


@pytest.mark.django_db
@override_settings(ZAVUDEV_API_KEY="", ZAVUDEV_OTP_CHANNEL="sms_oneway", ZAVUDEV_OTP_TEST_CODE="123456")
def test_otp_verify_logs_in_and_marks_email_verified():
    cache.clear()
    api_client = APIClient()
    user = get_user_model().objects.create_user(username="jean@example.com", email="jean@example.com", phone="+2250700000000", password="NovexPass123")
    api_client.post("/api/v1/auth/otp/request/", {"email": user.email}, format="json")

    response = api_client.post(
        "/api/v1/auth/otp/verify/",
        {
            "email": user.email,
            "code": "123456",
        },
        format="json",
    )

    user.refresh_from_db()
    assert response.status_code == 200
    assert user.email_verified_at is not None
    assert "sessionid" in response.cookies


@pytest.mark.django_db
@override_settings(ZAVUDEV_API_KEY="", ZAVUDEV_OTP_CHANNEL="sms_oneway", ZAVUDEV_OTP_TEST_CODE="123456")
def test_otp_request_is_rate_limited():
    cache.clear()
    api_client = APIClient()
    user = get_user_model().objects.create_user(username="jean@example.com", email="jean@example.com", phone="+2250700000000", password="NovexPass123")

    for _ in range(3):
        response = api_client.post("/api/v1/auth/otp/request/", {"email": user.email}, format="json")
        assert response.status_code == 200

    response = api_client.post("/api/v1/auth/otp/request/", {"email": user.email}, format="json")

    assert response.status_code == 400
    assert "otp" in response.data


@pytest.mark.django_db
def test_login_accepts_username_identifier_for_admin():
    api_client = APIClient()
    get_user_model().objects.create_superuser(username="admin", email="admin@novex.local", password="1234567890")

    response = api_client.post(
        "/api/v1/auth/login/",
        {
            "email": "admin",
            "password": "1234567890",
        },
        format="json",
    )

    assert response.status_code == 200
    assert response.data["email"] == "admin@novex.local"
