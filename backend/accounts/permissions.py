from rest_framework.permissions import BasePermission
from rest_framework.exceptions import APIException
from django.utils import timezone
from datetime import timedelta
from django.contrib.contenttypes.models import ContentType
from .models import FreeTrialUsage, UserSetAttempt
from osces.models import OSCESet
from subscriptions.models import UserSubscription   # direct import

class FreeTrialExpired(APIException):
    status_code = 403
    default_detail = "Your free trial has expired. Please subscribe to continue."
    default_code = 'free_trial_expired'

class OSCEBatchLimitExceeded(APIException):
    status_code = 403
    default_detail = "You have completed one OSCE batch. Please subscribe to continue."
    default_code = 'osce_batch_limit_exceeded'

class HasFreeAccessOrSubscription(BasePermission):
    """
    - Active subscription → allow all.
    - Otherwise, 60‑minute daily trial (global).
    - For OSCE sets, additionally restrict to **one batch across all sets**.
    """

    def _has_active_subscription(self, user):
        """Direct, reliable subscription check."""
        return UserSubscription.objects.filter(
            user=user,
            is_active=True,
            expires_at__gt=timezone.now()
        ).exists()

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Subscribed users have unlimited access
        if self._has_active_subscription(request.user):
            return True

        # Check daily 60‑minute trial
        today = timezone.now().date()
        usage, created = FreeTrialUsage.objects.get_or_create(
            user=request.user,
            date=today,
            defaults={'first_access': timezone.now()}
        )

        if not created:
            time_elapsed = timezone.now() - usage.first_access
            if time_elapsed > timedelta(minutes=60):
                raise FreeTrialExpired()

        return True

    def has_object_permission(self, request, view, obj):
        # Subscribed users bypass all object‑level checks
        if self._has_active_subscription(request.user):
            return True

        # Only enforce the OSCE batch limit for OSCE sets
        if isinstance(obj, OSCESet):
            # Get the content type for OSCESet
            osce_content_type = ContentType.objects.get_for_model(OSCESet)

            # Check if the user has already completed a batch in ANY OSCE set
            any_attempt = UserSetAttempt.objects.filter(
                user=request.user,
                content_type=osce_content_type,
                attempt_count__gte=1
            ).exists()

            if any_attempt:
                raise OSCEBatchLimitExceeded()

            # No attempt yet → allowed (first batch)
            return True

        # For other resource types, no extra limit
        return True