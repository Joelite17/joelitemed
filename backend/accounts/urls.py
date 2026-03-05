# accounts/urls.py
from django.urls import path
from .views import *
from rest_framework_simplejwt.views import TokenRefreshView

app_name = "accounts"

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("password-reset-confirm/<int:uid>/<str:token>/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("profile/", UserProfileView.as_view(), name="user-profile"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("dark-mode/", UpdateDarkModeView.as_view(), name="update-dark-mode")
]
