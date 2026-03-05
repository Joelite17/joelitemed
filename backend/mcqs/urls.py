# urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MCQSetViewSet, UserScoreViewSet

router = DefaultRouter()
router.register(r'', MCQSetViewSet, basename='mcqsets')

urlpatterns = [
    path('', include(router.urls)),
]
