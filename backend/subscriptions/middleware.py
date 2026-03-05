from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin

class SubscriptionMiddleware(MiddlewareMixin):
    """Middleware to check subscription for protected content"""
    
    PROTECTED_PATHS = [
        # '/mcqsets/',
        # '/api/flashcards/',
        # '/api/osces/',
        # '/api/notes/',
    ]
    
    def process_view(self, request, view_func, view_args, view_kwargs):
        # Skip for authentication endpoints and safe methods
        if any(path in request.path for path in ['/api/accounts/', '/api/subscriptions/']):
            return None
        
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return None
        
        # Check if path is protected
        if any(request.path.startswith(path) for path in self.PROTECTED_PATHS):
            if not request.user.is_authenticated:
                return JsonResponse(
                    {"error": "Authentication required"},
                    status=401
                )
            
            if not request.user.has_active_subscription:
                return JsonResponse(
                    {"error": "Active subscription required"},
                    status=403
                )
        
        return None