# accounts/models.py
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

class User(AbstractUser):
    COURSE_CHOICES = [
        ('medicine', 'Medicine'),
        ('surgery', 'Surgery'),
        ('commed', 'Community Medicine'),
    ]
    email_confirmed = models.BooleanField(default=False)
    dark_mode = models.BooleanField(
        default=False,
        help_text="User's preference for dark mode interface"
    )
    course_mode = models.CharField(
        max_length=20,
        choices=COURSE_CHOICES,
        blank=True,
        null=True,
        help_text="User's selected course mode for content filtering"
    )
    current_session_id = models.CharField(max_length=100, null=True, blank=True, editable=False)
    
    @property
    def has_active_subscription(self):
        if not hasattr(self, 'active_subscription'):
            return False
        return self.active_subscription.is_active
    
    @property
    def subscription_expiry(self):
        if not hasattr(self, 'active_subscription'):
            return None
        return self.active_subscription.expires_at
    
    @property
    def subscription_plan(self):
        if not hasattr(self, 'active_subscription'):
            return None
        return self.active_subscription.plan

    def __str__(self):
        return self.username


class UserSetAttempt(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='set_attempts'
    )
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    
    attempt_count = models.IntegerField(default=0)
    last_attempted = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('user', 'content_type', 'object_id')
        indexes = [
            models.Index(fields=['user', 'content_type', 'object_id']),
            models.Index(fields=['last_attempted']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.content_object} (Attempts: {self.attempt_count})"
    
    @property
    def set_type(self):
        return self.content_type.model


# New model for free trial tracking
class FreeTrialUsage(models.Model):
    """Tracks the first access time for unsubscribed users each day."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='trial_usage')
    date = models.DateField()
    first_access = models.DateTimeField()

    class Meta:
        unique_together = ('user', 'date')
        verbose_name = "Free Trial Usage"
        verbose_name_plural = "Free Trial Usages"

    def __str__(self):
        return f"{self.user.username} - {self.date}"