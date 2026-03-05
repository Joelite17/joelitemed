from django.contrib import admin
from .models import SubscriptionPlan, UserSubscription, PaymentTransaction

@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ['name', 'plan_type', 'amount', 'duration_days', 'is_active']
    list_filter = ['is_active', 'plan_type']
    search_fields = ['name', 'description']

@admin.register(UserSubscription)
class UserSubscriptionAdmin(admin.ModelAdmin):
    list_display = ['user', 'plan', 'started_at', 'expires_at', 'is_active', 'days_remaining']
    list_filter = ['is_active', 'plan']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['started_at']

@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = ['paystack_reference', 'user', 'plan', 'amount', 'status', 'created_at']
    list_afilter = ['status', 'created_at']
    search_fields = ['paystack_reference', 'user__username']
    readonly_fields = ['created_at', 'verified_at', 'metadata']