from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.views import APIView

from apps.accounts import serializers as ser
from apps.accounts.models import User
from apps.accounts.services import auth as auth_services
from common.responses import success_response


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = ser.LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user, token = auth_services.login_user(
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
            request=request,
        )
        return success_response(
            {
                "token": token.key,
                "user": ser.UserSerializer(user).data,
            },
            message="Login successful",
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        auth_services.logout_user(user=request.user, request=request)
        return success_response(message="Logged out")


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return success_response(ser.UserSerializer(request.user).data)


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

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

    def post(self, request):
        message = auth_services.change_password_request(user=request.user, request=request)
        return success_response(message=message)


class PasswordChangeConfirmView(APIView):
    permission_classes = [IsAuthenticated]

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


class CreateUserView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        serializer = ser.CreateUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = auth_services.create_team_user(
            actor=request.user,
            request=request,
            **serializer.validated_data,
        )
        return success_response(
            ser.UserSerializer(user).data,
            message="Team member created",
            status_code=status.HTTP_201_CREATED,
        )


class ActivateUserView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, user_id):
        user = get_object_or_404(User, id=user_id)
        user = auth_services.activate_user(actor=request.user, user=user, request=request)
        return success_response(ser.UserSerializer(user).data, message="User activated")


class DeactivateUserView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, user_id):
        user = get_object_or_404(User, id=user_id)
        user = auth_services.deactivate_user(actor=request.user, user=user, request=request)
        return success_response(ser.UserSerializer(user).data, message="User deactivated")
