from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from .models import User

class SessionJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        # First, perform the standard JWT authentication
        auth_result = super().authenticate(request)
        if auth_result is None:
            return None
        
        user, validated_token = auth_result

        # Extract session_id from the token
        token_session_id = validated_token.get('session_id')
        if token_session_id is None:
            raise AuthenticationFailed('Invalid token: missing session ID.')

        # Compare with the user's current session ID
        if user.current_session_id != token_session_id:
            # This token belongs to an old session – reject it
            raise AuthenticationFailed('Session expired or logged in elsewhere.')

        return (user, validated_token)