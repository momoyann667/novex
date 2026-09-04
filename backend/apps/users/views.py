from django.contrib.auth import login as django_login
from django.db import transaction
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .serializers import LoginSerializer, OTPRequestSerializer, OTPVerifySerializer, RegisterSerializer, UserSerializer


class AuthViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer

    @action(detail=False, methods=["post"], url_path="register")
    @transaction.atomic
    def register(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        otp_serializer = OTPRequestSerializer(data={"email": user.email}, context={"request": request})
        otp_serializer.is_valid(raise_exception=True)
        otp = otp_serializer.save()
        payload = UserSerializer(user).data
        payload["requires_otp"] = True
        payload["otp_delivery"] = {
            "channel": otp.channel,
            "destination": otp.destination,
            "expires_at": otp.expires_at,
        }
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="login", serializer_class=LoginSerializer)
    def login(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        django_login(request, user)
        return Response(UserSerializer(user, context={"request": request}).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="otp/request", serializer_class=OTPRequestSerializer)
    def request_otp(self, request):
        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        otp = serializer.save()
        return Response(
            {
                "message": "Code OTP envoye.",
                "otp_delivery": {
                    "channel": otp.channel,
                    "destination": otp.destination,
                    "expires_at": otp.expires_at,
                },
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="otp/verify", serializer_class=OTPVerifySerializer)
    def verify_otp(self, request):
        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        django_login(request, user)
        return Response(UserSerializer(user, context={"request": request}).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="me", permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        return Response(UserSerializer(request.user, context={"request": request, "workspace_slug": request.headers.get("X-Workspace")}).data, status=status.HTTP_200_OK)
