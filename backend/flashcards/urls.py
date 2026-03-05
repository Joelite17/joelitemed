from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FlashcardSetViewSet

router = DefaultRouter()
router.register(r'', FlashcardSetViewSet, basename='flashcardsets')

urlpatterns = [
    path('', include(router.urls)),
]