from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied
from django.utils import timezone
from datetime import timedelta
from .models import UserSetAttempt, FreeTrialUsage
from django.contrib.contenttypes.models import ContentType

class HasFreeAccessOrSubscription(permissions.BasePermission):
    """
    Custom permission for free users:
    - 60 minutes total per day (across all content).
    - For MCQ/Flashcard sets: one batch (10 items) per set per day (resets after 24h).
    - For OSCE sets: only one batch total across all sets (no reset).
    """
    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user.is_authenticated:
            return False

        # 1. Active subscription → always allowed
        if user.has_active_subscription:
            return True

        # 2. Daily free trial time limit (60 minutes)
        today = timezone.now().date()
        usage = FreeTrialUsage.objects.filter(user=user, date=today).first()
        if usage:
            if (timezone.now() - usage.first_access).total_seconds() > 60 * 60:
                raise PermissionDenied(
                    detail="You have used your 60 minutes of free access today. Please subscribe or wait 24 hours.",
                    code="free_trial_expired"
                )
        else:
            FreeTrialUsage.objects.create(user=user, date=today, first_access=timezone.now())

        model_name = obj._meta.model_name

        # 3. MCQ / Flashcard sets: per‑set daily batch limit
        if model_name == 'mcqset':
            content_type = ContentType.objects.get_for_model(obj)
            try:
                attempt = UserSetAttempt.objects.get(
                    user=user,
                    content_type=content_type,
                    object_id=obj.id
                )
            except UserSetAttempt.DoesNotExist:
                attempt = None

            if attempt and attempt.attempt_count >= 1:
                # Check if last attempt was within the last 24 hours
                if attempt.last_attempted and (timezone.now() - attempt.last_attempted) < timedelta(days=1):
                    raise PermissionDenied(
                        detail="You have already completed one batch of this set today. Please subscribe or wait 24 hours.",
                        code="daily_batch_limit"
                    )
                else:
                    # More than 24 hours ago → reset attempt count so user starts from batch 1
                    attempt.attempt_count = 0
                    attempt.save()

        # 4. OSCE sets: global limit – only one batch total across all OSCE sets
        elif model_name == 'osceset':
            osce_content_type = ContentType.objects.get_for_model(obj)
            # If the user has any OSCE set attempt with attempt_count >= 1, block access
            if UserSetAttempt.objects.filter(
                user=user,
                content_type=osce_content_type,
                attempt_count__gte=1
            ).exists():
                raise PermissionDenied(
                    detail="You have completed one OSCE batch. Please subscribe to continue with more OSCE stations.",
                    code="osce_batch_limit_exceeded"
                )

        # All checks passed → allow access
        return True