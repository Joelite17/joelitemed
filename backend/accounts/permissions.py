# accounts/permissions.py
from rest_framework.permissions import BasePermission
from django.utils import timezone
from datetime import timedelta
from .models import FreeTrialUsage
from .exceptions import FreeTrialExpired

class HasFreeAccessOrSubscription(BasePermission):
    """
    Allows access if user has an active subscription.
    If not, grants access for the first 20 minutes of the day (based on first request).
    After 20 minutes, raises FreeTrialExpired.
    """

    def has_permission(self, request, view):
        # Must be authenticated
        if not request.user or not request.user.is_authenticated:
            return False

        # Active subscription → allow
        if request.user.has_active_subscription:
            return True

        today = timezone.now().date()
        usage, created = FreeTrialUsage.objects.get_or_create(
            user=request.user,
            date=today,
            defaults={'first_access': timezone.now()}
        )

        if created:
            return True

        time_elapsed = timezone.now() - usage.first_access
        if time_elapsed > timedelta(minutes=20):
            raise FreeTrialExpired()

        return True