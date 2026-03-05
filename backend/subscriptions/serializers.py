from rest_framework import serializers
from .models import SubscriptionPlan, UserSubscription, PaymentTransaction
from accounts.models import User
from django.utils import timezone

class SubscriptionPlanSerializer(serializers.ModelSerializer):
    """Serializer for subscription plans"""
    formatted_amount = serializers.SerializerMethodField()
    
    class Meta:
        model = SubscriptionPlan
        fields = ['id', 'name', 'plan_type', 'amount', 'formatted_amount', 
                  'duration_days', 'description', 'is_active']
        read_only_fields = ['id']
    
    def get_formatted_amount(self, obj):
        return f"₦{obj.amount:,}"

class UserSubscriptionSerializer(serializers.ModelSerializer):
    """Serializer for user's active subscription"""
    plan = SubscriptionPlanSerializer(read_only=True)
    plan_id = serializers.PrimaryKeyRelatedField(
        queryset=SubscriptionPlan.objects.filter(is_active=True),
        write_only=True,
        source='plan'
    )
    days_remaining = serializers.IntegerField(read_only=True)
    formatted_expiry = serializers.SerializerMethodField()
    
    class Meta:
        model = UserSubscription
        fields = ['id', 'plan', 'plan_id', 'started_at', 'expires_at', 
                  'formatted_expiry', 'is_active', 'days_remaining']
        read_only_fields = ['id', 'started_at', 'expires_at', 'is_active', 'days_remaining']
    
    def get_formatted_expiry(self, obj):
        return obj.expires_at.strftime("%B %d, %Y") if obj.expires_at else None

class InitializePaymentSerializer(serializers.Serializer):
    """Serializer for initializing payment"""
    plan_id = serializers.PrimaryKeyRelatedField(
        queryset=SubscriptionPlan.objects.filter(is_active=True),
        error_messages={
            'does_not_exist': 'Invalid subscription plan selected.',
            'incorrect_type': 'Plan ID must be a number.'
        }
    )
    
    def validate(self, attrs):
        user = self.context['request'].user
        plan = attrs['plan_id']
        
        print(f"DEBUG: Validating for user {user.username}, plan {plan.name}")
        
        # Check if user already has active subscription
        active_subscription = UserSubscription.objects.filter(
            user=user, 
            is_active=True,
            expires_at__gt=timezone.now()
        ).first()
        
        if active_subscription:
            raise serializers.ValidationError(
                f"You already have an active {active_subscription.plan.name} subscription " +
                f"that expires on {active_subscription.expires_at.strftime('%B %d, %Y')}"
            )
        
        return attrs

class PaymentTransactionSerializer(serializers.ModelSerializer):
    """Serializer for payment transactions"""
    plan = SubscriptionPlanSerializer(read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    formatted_amount = serializers.SerializerMethodField()
    formatted_date = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = PaymentTransaction
        fields = ['id', 'plan', 'user_email', 'amount', 'formatted_amount', 
                  'paystack_reference', 'status', 'status_display', 'created_at',
                  'formatted_date', 'verified_at', 'metadata']
        read_only_fields = fields
    
    def get_formatted_amount(self, obj):
        return f"₦{obj.amount:,}"
    
    def get_formatted_date(self, obj):
        return obj.created_at.strftime("%Y-%m-%d %H:%M")