import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.users.models import Profile


@pytest.mark.django_db
def test_register_creates_user_and_profile():
    api_client = APIClient()
    response = api_client.post(
        "/api/v1/auth/register/",
        {
            "first_name": "Jean",
            "last_name": "Dupont",
            "email": "JEAN@example.com",
            "password": "NovexPass123",
            "password_confirmation": "NovexPass123",
            "accepted_terms": True,
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.data["email"] == "jean@example.com"
    user = get_user_model().objects.get(email="jean@example.com")
    assert user.terms_accepted_at is not None
    assert Profile.objects.get(user=user).first_name == "Jean"


@pytest.mark.django_db
def test_register_rejects_existing_email():
    api_client = APIClient()
    get_user_model().objects.create_user(email="jean@example.com", password="NovexPass123")

    response = api_client.post(
        "/api/v1/auth/register/",
        {
            "first_name": "Jean",
            "last_name": "Dupont",
            "email": "jean@example.com",
            "password": "NovexPass123",
            "password_confirmation": "NovexPass123",
            "accepted_terms": True,
        },
        format="json",
    )

    assert response.status_code == 400
    assert "email" in response.data
