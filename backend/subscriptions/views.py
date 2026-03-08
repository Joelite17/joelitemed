from rest_framework import viewsets, generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.views import APIView
from django.utils import timezone
from django.db import transaction
from django.shortcuts import get_object_or_404
import secrets
import json
from decouple import config

from .models import SubscriptionPlan, UserSubscription, PaymentTransaction
from .serializers import (
    SubscriptionPlanSerializer, 
    UserSubscriptionSerializer,
    InitializePaymentSerializer,
    PaymentTransactionSerializer
)
from .paystack_service import PaystackService
from .permissions import HasActiveSubscription
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

class SubscriptionPlanViewSet(viewsets.ReadOnlyModelViewSet):
    """View for listing available subscription plans"""
    queryset = SubscriptionPlan.objects.filter(is_active=True)
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [permissions.AllowAny]

class SubscriptionView(APIView):
    """Handle user subscription operations"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Get user's current subscription"""
        try:
            # Try to get active subscription
            subscription = UserSubscription.objects.filter(
                user=request.user, 
                is_active=True
            ).first()
            
            if subscription:
                serializer = UserSubscriptionSerializer(subscription)
                return Response({
                    "has_subscription": True,
                    "plan_name": subscription.plan.name,
                    "plan_type": subscription.plan.plan_type,
                    "started_at": subscription.started_at,
                    "expires_at": subscription.expires_at,
                    "is_active": subscription.is_active,
                    "days_remaining": subscription.days_remaining,
                    "plan_details": SubscriptionPlanSerializer(subscription.plan).data
                })
            else:
                return Response({
                    "has_subscription": False,
                    "message": "No active subscription found"
                })
        except Exception as e:
            return Response({
                "has_subscription": False,
                "error": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class PaymentView(APIView):
    """Handle payment initialization and verification"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """Initialize payment"""
        logger.info(f"Payment initialization request from user: {request.user.username}")
        logger.info(f"Request data: {request.data}")
        
        serializer = InitializePaymentSerializer(
            data=request.data,
            context={'request': request}
        )
        
        if not serializer.is_valid():
            logger.error(f"Serializer errors: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            plan = serializer.validated_data['plan_id']
            user = request.user
            
            logger.info(f"Processing payment for user: {user.email}, plan: {plan.name}")
            
            # Validate user email
            if not user.email or '@' not in user.email:
                logger.error(f"User {user.username} has invalid email: {user.email}")
                return Response(
                    {"error": "Your account email is invalid. Please update your email address in your profile."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if user already has active subscription
            active_subscription = UserSubscription.objects.filter(
                user=user, 
                is_active=True,
                expires_at__gt=timezone.now()
            ).first()
            
            if active_subscription:
                logger.warning(f"User {user.username} already has active subscription")
                return Response(
                    {"error": "You already have an active subscription"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Generate unique reference
            reference = f"SUB_{secrets.token_hex(10).upper()}"
            
            # Create pending payment transaction
            payment = PaymentTransaction.objects.create(
                user=user,
                plan=plan,
                amount=plan.amount,
                paystack_reference=reference,
                status='pending',
                metadata={
                    "user_id": user.id,
                    "user_email": user.email,
                    "user_username": user.username,
                    "plan_name": plan.name,
                    "plan_type": plan.plan_type,
                    "amount": plan.amount,
                    "currency": "NGN"
                }
            )
            
            logger.info(f"Created payment transaction: {reference}")
            
            # Initialize Paystack payment
            paystack = PaystackService()
            
            try:
                # Calculate amount in kobo
                amount_in_kobo = int(plan.amount * 100)
                
                payment_data = paystack.initialize_transaction(
                    email=user.email,
                    amount=amount_in_kobo,
                    reference=reference,
                    callback_url=f"{config("FRONTEND_URL")}/payment/verify/{reference}"
                )
                
                logger.info(f"Paystack response: {payment_data}")
                
                if not payment_data.get('authorization_url'):
                    logger.error(f"No authorization_url in Paystack response: {payment_data}")
                    raise Exception("Paystack did not return payment authorization URL")
                
                payment.paystack_access_code = payment_data.get('access_code', '')
                payment.authorization_url = payment_data.get('authorization_url', '')
                payment.save()
                
                logger.info(f"Payment initialized successfully. Authorization URL: {payment_data['authorization_url']}")
                
                return Response({
                    "success": True,
                    "authorization_url": payment_data['authorization_url'],
                    "reference": reference,
                    "access_code": payment_data.get('access_code', ''),
                    "amount": plan.amount,
                    "plan": SubscriptionPlanSerializer(plan).data,
                    "email": user.email,
                    "public_key": config("PAYSTACK_PUBLIC_KEY"),
                    "message": "Payment initialized successfully. Redirecting to payment gateway..."
                })
                
            except Exception as paystack_error:
                logger.error(f"Paystack initialization error: {str(paystack_error)}")
                payment.status = 'failed'
                payment.metadata['paystack_error'] = str(paystack_error)
                payment.save()
                
                return Response(
                    {"error": f"Failed to initialize payment: {str(paystack_error)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
                
        except Exception as e:
            logger.error(f"General payment error: {str(e)}")
            return Response(
                {"error": f"An error occurred: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def get(self, request, reference):
        """Verify payment"""
        logger.info(f"Verifying payment with reference: {reference}")
        logger.info(f"Request user: {request.user.username}")
        
        try:
            payment = PaymentTransaction.objects.get(
                paystack_reference=reference,
                user=request.user
            )
            
            logger.info(f"Found payment: {payment.status}")
            
            if payment.status == 'success':
                logger.info(f"Payment already verified: {reference}")
                return Response({
                    "success": True,
                    "message": "Payment already verified",
                    "payment": PaymentTransactionSerializer(payment).data
                })
            
            # Verify with Paystack
            paystack = PaystackService()
            verification = paystack.verify_transaction(reference)
            print(verification)
            logger.info(f"Paystack verification status: {verification.get('status')}")
            verification = paystack.verify_transaction(reference)
            
            if verification.get('status') == 'success':
                with transaction.atomic():
                    # Update payment status
                    payment.status = 'success'
                    payment.verified_at = timezone.now()
                    payment.metadata['paystack_response'] = verification
                    payment.save()
                    
                    # Create or update user subscription
                    plan = payment.plan
                    expires_at = timezone.now() + timezone.timedelta(days=plan.duration_days)
                    
                    # Deactivate any existing subscriptions
                    UserSubscription.objects.filter(
                        user=request.user, 
                        is_active=True
                    ).update(is_active=False)
                    
                    # Create new subscription
                    subscription = UserSubscription.objects.create(
                        user=request.user,
                        plan=plan,
                        expires_at=expires_at,
                        is_active=True
                    )
                    
                    logger.info(f"Created subscription, expires at: {expires_at}")
                    
                    return Response({
                        "success": True,
                        "message": "Payment verified and subscription activated",
                        "expires_at": expires_at,
                        "plan": SubscriptionPlanSerializer(plan).data,
                        "subscription": {
                            "id": subscription.id,
                            "started_at": subscription.started_at,
                            "expires_at": subscription.expires_at,
                            "is_active": subscription.is_active
                        }
                    })
            else:
                payment.status = 'failed'
                payment.metadata['verification_response'] = verification
                payment.save()
                
                logger.error(f"Payment verification failed: {verification}")
                
                return Response(
                    {"error": "Payment verification failed", "details": verification},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        except PaymentTransaction.DoesNotExist:
            logger.error(f"Payment not found with reference: {reference}")
            return Response(
                {"error": "Payment not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Verification error: {str(e)}")
            return Response(
                {"error": f"Verification error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class PaymentHistoryView(generics.ListAPIView):
    """View user's payment history"""
    serializer_class = PaymentTransactionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return PaymentTransaction.objects.filter(
            user=self.request.user
        ).order_by('-created_at')