"""CRM access permissions — all active team members have equal CRM access."""

from rest_framework.permissions import BasePermission


class IsActiveCRMMember(BasePermission):
    """Active authenticated users who are CRM team members (or staff)."""

    message = "Active CRM team membership is required."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if not user.is_active:
            return False
        if user.is_staff:
            return True
        return hasattr(user, "team_member") and user.team_member.is_active
