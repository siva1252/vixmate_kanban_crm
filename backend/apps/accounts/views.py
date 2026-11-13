from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiExample, OpenApiResponse, extend_schema
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from apps.accounts import serializers as ser
from apps.accounts.models import User
from apps.accounts.services import auth as auth_services
from common.permissions import IsActiveCRMMember
from common.responses import success_response


class AuthLoginThrottle(AnonRateThrottle):
    scope = "auth_login"


class AuthRefreshThrottle(AnonRateThrottle):
    scope = "auth_refresh"


class AuthOtpThrottle(AnonRateThrottle):
    scope = "auth_otp"


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [AuthLoginThrottle]

    @extend_schema(
        tags=["auth"],
        summary="Login",
        description=(
            "Returns JWT `access` + `refresh`. "
            "Authorize with the **access** token. Use `/api/auth/token/refresh/` when it expires."
        ),
        request=ser.LoginSerializer,
        examples=[
            OpenApiExample(
                "Team lead",
                value={
                    "email": "siva@viximate.com",
                    "password": "Viximate@high5",
                },
                request_only=True,
            )
        ],
        responses={200: OpenApiResponse(description="Login successful")},
    )
    def post(self, request):
        serializer = ser.LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user, tokens = auth_services.login_user(
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
            request=request,
        )
        user = User.objects.select_related("team_member").get(pk=user.pk)
        return success_response(
            {
                **tokens,
                "user": ser.UserSerializer(user).data,
            },
            message="Login successful",
        )


class TokenRefreshView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [AuthRefreshThrottle]

    @extend_schema(
        tags=["auth"],
        summary="Refresh access token",
        description="Exchange a valid refresh token for a new access token (and rotated refresh).",
        request=ser.TokenRefreshSerializer,
        responses={200: OpenApiResponse(description="Token refreshed")},
    )
    def post(self, request):
        serializer = ser.TokenRefreshSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tokens = auth_services.refresh_tokens(refresh=serializer.validated_data["refresh"])
        return success_response(tokens, message="Token refreshed")


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["auth"],
        summary="Logout",
        description="Blacklists the refresh token. Send access token in Authorization header.",
        request=ser.LogoutSerializer,
        responses={200: OpenApiResponse(description="Logged out")},
    )
    def post(self, request):
        serializer = ser.LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        auth_services.logout_user(
            user=request.user,
            refresh=serializer.validated_data["refresh"],
            request=request,
        )
        return success_response(message="Logged out")


class MeView(APIView):
    permission_classes = [IsActiveCRMMember]

    @extend_schema(tags=["auth"], summary="Current user", responses={200: ser.UserSerializer})
    def get(self, request):
        user = (
            type(request.user)
            .objects.select_related("team_member")
            .filter(pk=request.user.pk)
            .first()
            or request.user
        )
        return success_response(ser.UserSerializer(user).data)


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [AuthOtpThrottle]

    @extend_schema(tags=["auth"], summary="Forgot password", request=ser.EmailSerializer)
    def post(self, request):
        serializer = ser.EmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = auth_services.forgot_password(
            email=serializer.validated_data["email"],
            request=request,
        )
        return success_response(message=message)


class OTPVerifyView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [AuthOtpThrottle]

    @extend_schema(tags=["auth"], summary="Verify OTP", request=ser.OTPVerifySerializer)
    def post(self, request):
        serializer = ser.OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = auth_services.verify_otp(
            email=serializer.validated_data["email"],
            purpose=serializer.validated_data["purpose"],
            otp_code=serializer.validated_data["otp"],
            request=request,
        )
        return success_response(data, message="OTP verified")


class OTPResendView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [AuthOtpThrottle]

    @extend_schema(tags=["auth"], summary="Resend OTP", request=ser.OTPResendSerializer)
    def post(self, request):
        serializer = ser.OTPResendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = auth_services.resend_otp(
            email=serializer.validated_data["email"],
            purpose=serializer.validated_data["purpose"],
            request=request,
        )
        return success_response(message=message)


class PasswordResetView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [AuthOtpThrottle]

    @extend_schema(tags=["auth"], summary="Reset password", request=ser.PasswordResetSerializer)
    def post(self, request):
        serializer = ser.PasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        auth_services.reset_password(
            email=serializer.validated_data["email"],
            verification_id=str(serializer.validated_data["verification_id"]),
            new_password=serializer.validated_data["new_password"],
            request=request,
        )
        return success_response(message="Password has been reset.")


class PasswordChangeRequestView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["auth"], summary="Request password change OTP", request=None)
    def post(self, request):
        message = auth_services.change_password_request(user=request.user, request=request)
        return success_response(message=message)


class PasswordChangeConfirmView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["auth"], summary="Confirm password change", request=ser.PasswordChangeConfirmSerializer)
    def post(self, request):
        serializer = ser.PasswordChangeConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        auth_services.change_password_confirm(
            user=request.user,
            otp_code=serializer.validated_data["otp"],
            current_password=serializer.validated_data["current_password"],
            new_password=serializer.validated_data["new_password"],
            request=request,
        )
        return success_response(message="Password changed successfully.")


class PasswordChangeDirectView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["auth"],
        summary="Change password (current + new, no OTP)",
        request=ser.PasswordChangeDirectSerializer,
    )
    def post(self, request):
        serializer = ser.PasswordChangeDirectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        auth_services.change_password_direct(
            user=request.user,
            current_password=serializer.validated_data["current_password"],
            new_password=serializer.validated_data["new_password"],
            request=request,
        )
        return success_response(message="Password updated.")


class ActivateUserView(APIView):
    permission_classes = [IsAdminUser]

    @extend_schema(
        tags=["auth"],
        summary="Activate user",
        description="Staff-only. Team users are created manually in Admin/DB; this only flips active.",
        request=None,
    )
    def patch(self, request, user_id):
        user = get_object_or_404(User, id=user_id)
        user = auth_services.activate_user(actor=request.user, user=user, request=request)
        return success_response(ser.UserSerializer(user).data, message="User activated")


class DeactivateUserView(APIView):
    permission_classes = [IsAdminUser]

    @extend_schema(
        tags=["auth"],
        summary="Deactivate user",
        description="Staff-only. Disables CRM access for a manually provisioned team member.",
        request=None,
    )
    def patch(self, request, user_id):
        user = get_object_or_404(User, id=user_id)
        user = auth_services.deactivate_user(actor=request.user, user=user, request=request)
        return success_response(ser.UserSerializer(user).data, message="User deactivated")
