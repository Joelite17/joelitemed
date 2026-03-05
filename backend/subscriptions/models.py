from django.db import models
from django.conf import settings
from django.utils import timezone

class SubscriptionPlan(models.Model):
    """Predefined subscription plans"""
    PLAN_TYPES = [
        ('monthly 2', '2 Month'),
        ('monthly', '1 Month'),
        ('three_months', '3 Months'),
        ('six_months', '6 Months'),
        ('yearly', '1 Year'),
    ]
    
    name = models.CharField(max_length=50)
    plan_type = models.CharField(max_length=20, choices=PLAN_TYPES, unique=True)
    amount = models.PositiveIntegerField(help_text="Amount in Naira")
    duration_days = models.PositiveIntegerField()
    description = models.TextField()
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['amount']
    
    def __str__(self):
        return f"{self.name} - ₦{self.amount:,}"

class UserSubscription(models.Model):
    """Track user's active subscription"""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='active_subscription'
    )
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT)
    started_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['-started_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.plan.name}"
    
    @property
    def days_remaining(self):
        if not self.is_active:
            return 0
        remaining = (self.expires_at - timezone.now()).days
        return max(0, remaining)
    
    def check_and_update_status(self):
        """Check if subscription has expired"""
        if self.expires_at < timezone.now():
            self.is_active = False
            self.save()
        return self.is_active

class PaymentTransaction(models.Model):
    """Record all payment transactions"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='payments'
    )
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT)
    amount = models.PositiveIntegerField()
    paystack_reference = models.CharField(max_length=100, unique=True)
    paystack_access_code = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.paystack_reference} - ₦{self.amount:,} - {self.status}"