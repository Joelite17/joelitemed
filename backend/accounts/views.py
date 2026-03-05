from rest_framework.response import Response
from rest_framework import status, generics, permissions
from .serializers import *
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from .utils import send_password_reset_email
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError
from django.contrib.auth.password_validation import validate_password  # ADD THIS
import logging

logger = logging.getLogger(__name__)

User = get_user_model()

def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = (permissions.AllowAny,)

    def create(self, request, *args, **kwargs):
        try:
            response = super().create(request, *args, **kwargs)
            return Response({
                "detail": "Account created successfully. Please log in.",
                "user": response.data
            }, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            # Format validation errors for frontend
            error_response = {}
            for field, messages in e.detail.items():
                if isinstance(messages, list):
                    error_response[field] = messages[0] if messages else "Invalid value"
                else:
                    error_response[field] = str(messages)
            return Response(error_response, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Registration error: {str(e)}")
            return Response(
                {"detail": "An error occurred during registration. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class LoginView(APIView):
    permission_classes = (permissions.AllowAny,)
    
    def post(self, request):
        try:
            serializer = LoginSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            user = serializer.validated_data["user"]
            tokens = get_tokens_for_user(user)
            
            # Include user data with dark_mode in response
            user_data = UserSerializer(user).data
            
            return Response({
                "detail": "Login successful",
                "user": user_data, 
                "tokens": tokens
            })
            
        except ValidationError as e:
            logger.warning(f"Login failed for {request.data.get('identifier', 'unknown')}")
            return Response(
                {"detail": "Invalid credentials. Please check your email/username and password."},
                status=status.HTTP_401_UNAUTHORIZED
            )
        except Exception as e:
            logger.error(f"Login error: {str(e)}")
            return Response(
                {"detail": "An error occurred during login. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        try:
            # With JWT, logout is client-side, but you can blacklist the token if needed
            # For now, just return success
            return Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Logout error: {str(e)}")
            return Response(
                {"detail": "An error occurred during logout."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class PasswordResetRequestView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        try:
            serializer = PasswordResetRequestSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            email = serializer.validated_data["email"]
            
            try:
                user = User.objects.get(email=email)
                token = default_token_generator.make_token(user)
                send_password_reset_email(user, token)  # uses React link now
                logger.info(f"Password reset email sent to {email}")
            except User.DoesNotExist:
                pass  # don't reveal whether email exists
            
            return Response(
                {"detail": "If the email exists, a reset link was sent."},
                status=status.HTTP_200_OK,
            )
            
        except ValidationError as e:
            return Response(
                {"detail": "Please provide a valid email address."},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Password reset request error: {str(e)}")
            return Response(
                {"detail": "An error occurred. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class PasswordResetConfirmView(APIView):
    permission_classes = (permissions.AllowAny,)
    
    def post(self, request, uid, token):
        try:
            serializer = SetNewPasswordSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            user = get_object_or_404(User, pk=uid)
            if not default_token_generator.check_token(user, token):
                return Response(
                    {"detail": "Invalid or expired token."}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            user.set_password(serializer.validated_data["password"])
            user.save()
            logger.info(f"Password reset successful for user {user.username}")
            
            return Response(
                {"detail": "Password has been reset successfully."}, 
                status=status.HTTP_200_OK
            )
            
        except ValidationError as e:
            error_response = {}
            for field, messages in e.detail.items():
                if isinstance(messages, list):
                    error_response[field] = messages[0] if messages else "Invalid value"
                else:
                    error_response[field] = str(messages)
            return Response(error_response, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Password reset confirm error: {str(e)}")
            return Response(
                {"detail": "An error occurred. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# UPDATED UserProfileView with email uniqueness check
class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        data = request.data.copy()  # Work with a copy to avoid modifying request data
        
        # Check if email is being changed
        if 'email' in data and data['email'] != user.email:
            # Check if new email already exists (excluding current user)
            if User.objects.filter(email=data['email']).exclude(id=user.id).exists():
                return Response(
                    {"email": ["This email is already associated with another account."]},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Check if password change is requested
        if 'current_password' in data or 'new_password1' in data or 'new_password2' in data:
            # Validate current password
            current_password = data.get('current_password')
            if not current_password:
                return Response(
                    {"current_password": ["Current password is required to change password."]},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not user.check_password(current_password):
                return Response(
                    {"current_password": ["Current password is incorrect."]},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate new passwords
            new_password1 = data.get('new_password1')
            new_password2 = data.get('new_password2')
            
            if new_password1 and new_password2:
                if new_password1 != new_password2:
                    return Response(
                        {"new_password2": ["New passwords do not match."]},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                try:
                    validate_password(new_password1, user)
                except ValidationError as e:
                    return Response(
                        {"new_password1": list(e.messages)},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Set new password
                user.set_password(new_password1)
                user.save()
            
            # Remove password fields from data so they don't get saved in other fields
            data.pop('current_password', None)
            data.pop('new_password1', None)
            data.pop('new_password2', None)
        
        # Also check username uniqueness if username is being changed
        if 'username' in data and data['username'] != user.username:
            if User.objects.filter(username=data['username']).exclude(id=user.id).exists():
                return Response(
                    {"username": ["This username is already taken."]},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Update user with validated data
        serializer = self.get_serializer(user, data=data, partial=True)
        
        try:
            serializer.is_valid(raise_exception=True)
        except ValidationError as e:
            # Format validation errors
            error_response = {}
            for field, messages in e.detail.items():
                if isinstance(messages, list):
                    error_response[field] = messages[0] if messages else "Invalid value"
                else:
                    error_response[field] = str(messages)
            return Response(error_response, status=status.HTTP_400_BAD_REQUEST)
        
        serializer.save()
        
        return Response(serializer.data)

# Add Dark Mode Update View
class UpdateDarkModeView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def patch(self, request):
        user = request.user
        serializer = UpdateDarkModeSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)