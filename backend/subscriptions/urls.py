from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import *

router = DefaultRouter()
router.register(r'plans', SubscriptionPlanViewSet, basename='subscription-plans')

urlpatterns = [
    path('', include(router.urls)),
    path('my-subscription/', SubscriptionView.as_view(), name='my-subscription'),
    path('initialize-payment/', PaymentView.as_view(), name='initialize-payment'),
    path('verify-payment/<str:reference>/', PaymentView.as_view(), name='verify-payment'),
    path('payment-history/', PaymentHistoryView.as_view(), name='payment-history'),
]