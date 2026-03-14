from rest_framework.permissions import BasePermission
from rest_framework.exceptions import APIException
from django.utils import timezone
from datetime import timedelta
from django.contrib.contenttypes.models import ContentType
from .models import FreeTrialUsage
from osces.models import OSCESet
from subscriptions.models import UserSubscription

# ----------------------------------------------------------------------
# Custom exceptions (unchanged)
# ----------------------------------------------------------------------
class FreeTrialExpired(APIException):
    status_code = 403
    default_detail = "Your free trial has expired. Please subscribe to continue."
    default_code = 'free_trial_expired'

class OSCEBatchLimitExceeded(APIException):
    status_code = 403
    default_detail = "You can only access one OSCE set for free. Please subscribe to access more."
    default_code = 'osce_batch_limit_exceeded'

# ----------------------------------------------------------------------
# Permission class – modified to use first_osce_set instead of attempt count
# ----------------------------------------------------------------------
class HasFreeAccessOrSubscription(BasePermission):
    """
    - Active subscription → allow all.
    - Otherwise, 60‑minute daily trial (global).
    - For OSCE sets, additionally restrict to **one set total** (the first accessed).
    """

    def _has_active_subscription(self, user):
        """Check if the user has a valid, active subscription."""
        return UserSubscription.objects.filter(
            user=user,
            is_active=True,
            expires_at__gt=timezone.now()
        ).exists()

    def has_permission(self, request, view):
        """
        Global permission check: user must be authenticated, and daily trial is enforced.
        """
        if not request.user or not request.user.is_authenticated:
            return False

        # Subscribed users bypass all further checks
        if self._has_active_subscription(request.user):
            return True

        # 60‑minute daily trial (same as before)
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
        """
        Object‑level permission. Only applies to OSCE sets.
        For non‑OSCE resources, no extra restriction.
        """
        # Subscribed users always allowed
        if self._has_active_subscription(request.user):
            return True

        # Only enforce the one‑set limit for OSCE sets
        if isinstance(obj, OSCESet):
            # If user has no first_osce_set yet, the view will set it – allow for now
            if request.user.first_osce_set is None:
                return True

            # If this is the same set they already accessed, allow
            if request.user.first_osce_set == obj:
                return True

            # Otherwise, they are trying to access a different set – block
            raise OSCEBatchLimitExceeded()

        # For any other resource type (MCQ, Flashcard, Note, etc.), no extra limit
        return True