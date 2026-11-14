"""Django settings for Viximate CRM backend."""

from __future__ import annotations

import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent


def env(key: str, default: str | None = None) -> str | None:
    return os.environ.get(key, default)


def env_bool(key: str, default: bool = False) -> bool:
    value = os.environ.get(key)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_list(key: str, default: str = "") -> list[str]:
    raw = os.environ.get(key, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


_INSECURE_SECRET_DEFAULTS = {
    "insecure-dev-only-change-me",
    "change-me-to-a-long-random-string",
    "dev-local-vix-kanban-secret-key-change-in-prod",
}

DEBUG = env_bool("DJANGO_DEBUG", True)
SECRET_KEY = env("DJANGO_SECRET_KEY") or (
    "insecure-dev-only-change-me" if DEBUG else ""
)

if not SECRET_KEY or SECRET_KEY in _INSECURE_SECRET_DEFAULTS or len(SECRET_KEY) < 40:
    if not DEBUG:
        raise RuntimeError(
            "DJANGO_SECRET_KEY must be a long random value when DJANGO_DEBUG=False. "
            "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
        )
    # Dev only: keep bootable, but never ship this default to a live server with DEBUG off.
    SECRET_KEY = SECRET_KEY or "insecure-dev-only-change-me"

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "channels",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "drf_spectacular",
    "corsheaders",
    # Local apps
    "apps.accounts",
    "apps.team",
    "apps.lead_source",
    "apps.crm",
    "apps.contacts",
    "apps.assignments",
    "apps.calls",
    "apps.tasks",
    "apps.meetings",
    "apps.comments",
    "apps.followups",
    "apps.attachments",
    "apps.audit",
    "apps.custom_fields",
    "apps.configuration",
    "apps.realtime",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "common.middleware.request_id.RequestIdMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# Live board sync (WebSockets). In-memory is fine for single Daphne process (Docker/Jenkins).
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB", "viximate_crm"),
        "USER": env("POSTGRES_USER", "viximate"),
        "PASSWORD": env("POSTGRES_PASSWORD", "change-me"),
        "HOST": env("POSTGRES_HOST", "127.0.0.1"),
        "PORT": env("POSTGRES_PORT", "5432"),
        "CONN_MAX_AGE": 60,
        "OPTIONS": {
            "connect_timeout": 10,
        },
    }
}

# Allow SQLite only when explicitly enabled for local smoke tests without PostgreSQL.
if env_bool("USE_SQLITE", False):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / env("STATIC_ROOT", "staticfiles")
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / env("MEDIA_ROOT", "media")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "auth_login": "10/min",
        "auth_refresh": "30/min",
        "auth_otp": "10/min",
    },
    "DEFAULT_PAGINATION_CLASS": "common.pagination.StandardResultsSetPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_SCHEMA_CLASS": "common.schema.ViximateAutoSchema",
    "EXCEPTION_HANDLER": "common.exceptions.custom_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=int(env("JWT_ACCESS_MINUTES", "30") or "30")
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=int(env("JWT_REFRESH_DAYS", "7") or "7")
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "TOKEN_TYPE_CLAIM": "token_type",
    "JTI_CLAIM": "jti",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Viximate CRM API",
    "DESCRIPTION": (
        "Internal CRM + Kanban API aligned with the Viximate frontend flows.\n\n"
        "**Auth:** `POST /api/auth/login/` returns JWT `access` + `refresh`. "
        "Authorize with the **access** token only. Use `POST /api/auth/token/refresh/` "
        "when access expires.\n\n"
        "**Core demo path:** login → list config → create lead → move stage → "
        "assign working → edit lead (with reason) → list activity logs.\n\n"
        "See `docs/API.md` for full request/response walkthrough of one lead + one team member."
    ),
    "VERSION": "1.2.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "POSTPROCESSING_HOOKS": [
        "drf_spectacular.hooks.postprocess_schema_enums",
        "common.spectacular.inject_seeded_client_example",
    ],
    "SECURITY": [{"bearerAuth": []}],
    "APPEND_COMPONENTS": {
        "securitySchemes": {
            "bearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
                "description": "Paste the JWT **access** token from login (no Bearer prefix).",
            }
        }
    },
    "TAGS": [
        {"name": "auth", "description": "Login, logout, password, OTP"},
        {"name": "team", "description": "Team members"},
        {
            "name": "lead-source",
            "description": "External Lead Source people (no login) + their lead stats",
        },
        {"name": "configuration", "description": "Channel lead sources, services, industries"},
        {"name": "clients", "description": "Leads / clients CRUD"},
        {"name": "kanban", "description": "Board, stage/column management"},
        {"name": "assignments", "description": "Responsibility + Working assignments"},
        {"name": "comments", "description": "Lead comments"},
        {"name": "followups", "description": "Follow-ups"},
        {"name": "attachments", "description": "Lead documents"},
        {"name": "activity", "description": "Global audit / active logs"},
        {"name": "dashboard", "description": "Dashboard metrics"},
    ],
}

CORS_ALLOWED_ORIGINS = env_list(
    "DJANGO_CORS_ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:6018",
)
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = env_list(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:6018",
)

EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend",
)
EMAIL_HOST = env("EMAIL_HOST", "smtp.example.com")
EMAIL_PORT = int(env("EMAIL_PORT", "587") or "587")
EMAIL_HOST_USER = env("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", "noreply@viximate.local")

# Auth / OTP
OTP_EXPIRY_MINUTES = int(env("OTP_EXPIRY_MINUTES", "10") or "10")
OTP_MAX_ATTEMPTS = int(env("OTP_MAX_ATTEMPTS", "5") or "5")
OTP_RESEND_COOLDOWN_SECONDS = int(env("OTP_RESEND_COOLDOWN_SECONDS", "60") or "60")
OTP_MAX_RESENDS_PER_HOUR = int(env("OTP_MAX_RESENDS_PER_HOUR", "5") or "5")
FAILED_LOGIN_MAX_ATTEMPTS = int(env("FAILED_LOGIN_MAX_ATTEMPTS", "5") or "5")
FAILED_LOGIN_LOCKOUT_MINUTES = int(env("FAILED_LOGIN_LOCKOUT_MINUTES", "15") or "15")

# Attachments
ATTACHMENT_MAX_SIZE_MB = int(env("ATTACHMENT_MAX_SIZE_MB", "10") or "10")
ATTACHMENT_ALLOWED_EXTENSIONS = env_list(
    "ATTACHMENT_ALLOWED_EXTENSIONS",
    "pdf,png,jpg,jpeg,gif,webp,doc,docx,xls,xlsx,txt,csv",
)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django.security": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "apps.audit": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
