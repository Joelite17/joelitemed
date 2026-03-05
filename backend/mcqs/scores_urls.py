# mcqs/urls_scores.py
from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import UserScoreViewSet

router = DefaultRouter()
router.register(r'', UserScoreViewSet, basename='scores')

urlpatterns = [
    path('', include(router.urls)),
]
