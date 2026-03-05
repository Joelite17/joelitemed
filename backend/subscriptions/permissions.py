from rest_framework import permissions
from django.utils import timezone

class HasActiveSubscription(permissions.BasePermission):
    """Check if user has active subscription"""
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        # Allow GET requests to view content even without subscription
        # But require subscription for POST/PUT/DELETE
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # For write operations, check subscription
        return request.user.has_active_subscription

class IsSubscriptionOwner(permissions.BasePermission):
    """Check if user owns the subscription"""
    
    def has_object_permission(self, request, view, obj):
        return obj.user == request.user