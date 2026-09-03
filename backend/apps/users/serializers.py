from django.contrib.auth import authenticate
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
        email = attrs["email"].lower()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError({"email": "Un compte existe deja avec cet email."})
        if attrs["password"] != attrs["password_confirmation"]:
            raise serializers.ValidationError({"password_confirmation": "Les mots de passe ne correspondent pas."})
        if not attrs["accepted_terms"]:
            raise serializers.ValidationError({"accepted_terms": "Vous devez accepter les conditions."})
        validate_password(attrs["password"])
        attrs["email"] = email
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        password = validated_data.pop("password")
        validated_data.pop("password_confirmation")
        accepted_terms = validated_data.pop("accepted_terms")
        first_name = validated_data.pop("first_name")
        last_name = validated_data.pop("last_name")
        email = validated_data.pop("email")
        user = User.objects.create_user(username=email, email=email, password=password, terms_accepted_at=timezone.now() if accepted_terms else None, **validated_data)
        Profile.objects.create(user=user, first_name=first_name, last_name=last_name)
        return user


class UserSerializer(serializers.ModelSerializer):
    default_workspace = serializers.SerializerMethodField()
    profile = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "phone", "first_name", "last_name", "full_name", "email_verified_at", "profile", "default_workspace"]

    def get_profile(self, obj):
        profile = getattr(obj, "profile", None)
        if not profile:
            return None
        return {
            "first_name": profile.first_name,
            "last_name": profile.last_name,
            "full_name": str(profile),
            "avatar": profile.avatar.url if profile.avatar else "",
            "locale": profile.locale,
        }

    def get_full_name(self, obj):
        profile = getattr(obj, "profile", None)
        if profile and str(profile):
            return str(profile)
        return obj.get_full_name() or obj.username or obj.email

    def get_default_workspace(self, obj):
        membership = obj.workspace_memberships.filter(status="active").select_related("workspace").order_by("id").first()
        if not membership:
            return None
        return {
            "id": membership.workspace_id,
            "name": membership.workspace.name,
            "slug": membership.workspace.slug,
        }


class LoginSerializer(serializers.Serializer):
    email = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs["email"].strip().lower()
        if "@" not in email:
            user = User.objects.filter(username__iexact=email).first()
            email = user.email if user else email
        user = authenticate(request=self.context.get("request"), username=email, password=attrs["password"])
        if user is None:
            raise serializers.ValidationError({"credentials": "Email ou mot de passe incorrect."})
        if not user.is_active:
            raise serializers.ValidationError({"credentials": "Ce compte est desactive."})
        attrs["user"] = user
        return attrs
