from django.urls import path

from . import views

urlpatterns = [
    path("login/", views.LoginView.as_view(), name="auth-login"),
    path("token/refresh/", views.TokenRefreshView.as_view(), name="auth-token-refresh"),
    path("logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("me/", views.MeView.as_view(), name="auth-me"),
    path("forgot-password/", views.ForgotPasswordView.as_view(), name="auth-forgot-password"),
    path("otp/verify/", views.OTPVerifyView.as_view(), name="auth-otp-verify"),
    path("otp/resend/", views.OTPResendView.as_view(), name="auth-otp-resend"),
    path("password/reset/", views.PasswordResetView.as_view(), name="auth-password-reset"),
    path(
        "password/change/request/",
        views.PasswordChangeRequestView.as_view(),
        name="auth-password-change-request",
    ),
    path(
        "password/change/confirm/",
        views.PasswordChangeConfirmView.as_view(),
        name="auth-password-change-confirm",
    ),
    path(
        "password/change/",
        views.PasswordChangeDirectView.as_view(),
        name="auth-password-change-direct",
    ),
    # Team users are created manually (Admin / seed_demo_users), not via public API.
    path(
        "users/<uuid:user_id>/activate/",
        views.ActivateUserView.as_view(),
        name="auth-users-activate",
    ),
    path(
        "users/<uuid:user_id>/deactivate/",
        views.DeactivateUserView.as_view(),
        name="auth-users-deactivate",
    ),
]
