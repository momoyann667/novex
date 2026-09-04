from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
import re

from .models import Profile
from .otp import OTPError, check_otp_rate_limit, create_registration_otp, verify_registration_otp

User = get_user_model()


def normalize_phone(value: str) -> str:
    phone = re.sub(r"[\s().-]+", "", value.strip())
    if phone.startswith("00"):
        phone = f"+{phone[2:]}"
    return phone


class RegisterSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=120)
    last_name = serializers.CharField(max_length=120)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=32)
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
        phone = normalize_phone(attrs["phone"])
        if not re.fullmatch(r"\+[1-9]\d{7,14}", phone):
            raise serializers.ValidationError({"phone": "Renseigne le numero au format international, exemple +2250700000000."})
        validate_password(attrs["password"])
        attrs["email"] = email
        attrs["phone"] = phone
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
    workspace_access = serializers.SerializerMethodField()
    profile = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "phone", "first_name", "last_name", "full_name", "email_verified_at", "must_change_password", "profile", "default_workspace", "workspace_access", "is_staff", "is_superuser"]

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

    def get_workspace_access(self, obj):
        workspace_slug = self.context.get("workspace_slug")
        if obj.is_staff and obj.is_superuser:
            return {"role": "super_admin", "role_label": "Super Admin NOVEX", "permissions": ["*"], "workspace": None}
        if not workspace_slug:
            return None
        membership = (
            obj.workspace_memberships.filter(workspace__slug=workspace_slug, status="active")
            .select_related("workspace", "role")
            .prefetch_related("role__role_permissions__permission")
            .first()
        )
        if not membership:
            return None
        role_code = membership.role.code.upper()
        permissions = sorted({role_permission.permission.code for role_permission in membership.role.role_permissions.all()})
        if role_code in {"OWNER", "CREATOR"} and "*" not in permissions:
            permissions.append("*")
        role = "creator" if role_code in {"OWNER", "CREATOR"} else "membre" if role_code == "MEMBER" else role_code.lower()
        return {
            "workspace": {"id": membership.workspace_id, "name": membership.workspace.name, "slug": membership.workspace.slug},
            "role": role,
            "role_code": role_code,
            "role_label": membership.role.label,
            "permissions": permissions,
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
        if not user.email_verified_at and not user.is_staff and not user.is_superuser:
            raise serializers.ValidationError({"otp": "Compte non verifie. Valide le code OTP envoye apres inscription."})
        attrs["user"] = user
        return attrs


class OTPRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        email = value.lower()
        self.user = User.objects.filter(email=email).first()
        if not self.user:
            raise serializers.ValidationError("Aucun compte ne correspond a cet email.")
        return email

    def save(self):
        try:
            request = self.context.get("request")
            if request:
                check_otp_rate_limit(email=self.user.email, request=request, action="request")
            return create_registration_otp(self.user)
        except OTPError as exc:
            raise serializers.ValidationError({"otp": str(exc)}) from exc


class OTPVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(min_length=4, max_length=12)

    def validate_email(self, value):
        email = value.lower()
        self.user = User.objects.filter(email=email).first()
        if not self.user:
            raise serializers.ValidationError("Aucun compte ne correspond a cet email.")
        return email

    def save(self):
        try:
            request = self.context.get("request")
            if request:
                check_otp_rate_limit(email=self.user.email, request=request, action="verify")
            return verify_registration_otp(user=self.user, code=self.validated_data["code"].strip())
        except OTPError as exc:
            raise serializers.ValidationError({"code": str(exc)}) from exc
