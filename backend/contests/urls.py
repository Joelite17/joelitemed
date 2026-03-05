from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ContestViewSet, ContestParticipationViewSet

router = DefaultRouter()
# Register the more specific participations route FIRST
router.register(r'participations', ContestParticipationViewSet, basename='contest-participation')
router.register(r'', ContestViewSet, basename='contest')

urlpatterns = [
    path('', include(router.urls)),
]