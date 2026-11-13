from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.accounts.models import OTPPurpose, User


class UserSerializer(serializers.ModelSerializer):
    team_member_id = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()
    job_title = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "phone_number",
            "is_active",
            "is_staff",
            "date_joined",
            "last_login",
            "team_member_id",
            "display_name",
            "job_title",
        )
        read_only_fields = fields

    def get_team_member_id(self, obj):
        member = getattr(obj, "team_member", None)
        return str(member.id) if member else None

    def get_display_name(self, obj):
        member = getattr(obj, "team_member", None)
        if member and member.display_name:
            return member.display_name
        return obj.full_name

    def get_job_title(self, obj):
        member = getattr(obj, "team_member", None)
        return member.job_title if member else ""


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class TokenRefreshSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class EmailSerializer(serializers.Serializer):
    email = serializers.EmailField()


class OTPVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    purpose = serializers.ChoiceField(choices=OTPPurpose.choices)
    otp = serializers.CharField(min_length=4, max_length=12)


class OTPResendSerializer(serializers.Serializer):
    email = serializers.EmailField()
    purpose = serializers.ChoiceField(choices=OTPPurpose.choices)


class PasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()
    verification_id = serializers.UUIDField()
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value


class PasswordChangeRequestSerializer(serializers.Serializer):
    pass


class PasswordChangeConfirmSerializer(serializers.Serializer):
    otp = serializers.CharField(min_length=4, max_length=12)
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value


class PasswordChangeDirectSerializer(serializers.Serializer):
    """Logged-in password change — current + new only (no OTP)."""

    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_new_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        if attrs["current_password"] == attrs["new_password"]:
            raise serializers.ValidationError(
                {"new_password": "New password must be different from the current password."}
            )
        return attrs


class CreateUserSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=255)
    password = serializers.CharField(write_only=True)
    phone_number = serializers.CharField(required=False, allow_blank=True, default="")
    is_active = serializers.BooleanField(default=True)
    is_staff = serializers.BooleanField(default=False)

    def validate_password(self, value):
        validate_password(value)
        return value
