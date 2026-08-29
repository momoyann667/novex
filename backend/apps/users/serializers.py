from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import Profile

User = get_user_model()


class RegisterSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=120)
    last_name = serializers.CharField(max_length=120)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)
    password_confirmation = serializers.CharField(write_only=True)
    accepted_terms = serializers.BooleanField()

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirmation"]:
            raise serializers.ValidationError({"password_confirmation": "Les mots de passe ne correspondent pas."})
        if not attrs["accepted_terms"]:
            raise serializers.ValidationError({"accepted_terms": "Vous devez accepter les conditions."})
        validate_password(attrs["password"])
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        password = validated_data.pop("password")
        validated_data.pop("password_confirmation")
        accepted_terms = validated_data.pop("accepted_terms")
        first_name = validated_data.pop("first_name")
        last_name = validated_data.pop("last_name")
        email = validated_data["email"].lower()
        user = User.objects.create_user(username=email, email=email, password=password, terms_accepted_at=timezone.now() if accepted_terms else None, **validated_data)
        Profile.objects.create(user=user, first_name=first_name, last_name=last_name)
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "phone", "email_verified_at"]
