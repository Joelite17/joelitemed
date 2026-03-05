from rest_framework.routers import DefaultRouter
from .views import OSCESetViewSet

router = DefaultRouter()
router.register("", OSCESetViewSet, basename="osce-sets")

urlpatterns = router.urls
