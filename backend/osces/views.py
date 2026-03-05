from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from accounts.utils import get_next_items_for_user, increment_attempt_count, get_user_progress
from .models import *
from .serializers import *
from accounts.models import UserSetAttempt
from django.contrib.contenttypes.models import ContentType
from accounts.permissions import HasFreeAccessOrSubscription   # <-- new

class OSCESetViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = OSCESet.objects.all()
    serializer_class = OSCESetSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_permissions(self):
        if self.action == 'retrieve':
            return [HasFreeAccessOrSubscription()]
        return super().get_permissions()

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_authenticated and user.course_mode:
            queryset = queryset.filter(course_mode=user.course_mode)
        return queryset

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = serializer.data
        
        # Get next 10 OSCE cards for this user
        cards = get_next_items_for_user(
            request.user,
            instance,
            instance.cards.all(),
            items_per_set=10
        )
        
        # Get user progress
        progress = get_user_progress(
            request.user,
            instance,
            instance.cards.all(),
            items_per_set=10
        )
        
        # Update cards in response
        data["cards"] = OSCECardSerializer(cards, many=True).data
        data["progress"] = progress
        
        return Response(data)
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def toggle_like(self, request, pk=None):
        osce_set = self.get_object()
        user = request.user
        if osce_set.likes.filter(id=user.id).exists():
            osce_set.likes.remove(user)
            liked = False
        else:
            osce_set.likes.add(user)
            liked = True
        return Response({
            "liked": liked,
            "likes_count": osce_set.likes.count()
        })
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def increment_attempt(self, request, pk=None):
        """
        Increment attempt count for this set
        """
        instance = self.get_object()
        new_count = increment_attempt_count(request.user, instance)
        
        # Get updated progress
        progress = get_user_progress(
            request.user,
            instance,
            instance.cards.all(),
            items_per_set=10
        )
        
        return Response({
            "success": True,
            "attempt_count": new_count,
            "progress": progress,
            "message": f"Attempt count incremented to {new_count}"
        })
    
    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def get_progress(self, request, pk=None):
        """
        Get user's progress for this set
        """
        instance = self.get_object()
        progress = get_user_progress(
            request.user,
            instance,
            instance.cards.all(),
            items_per_set=10
        )
        
        return Response({
            "progress": progress
        })
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def reset_attempt(self, request, pk=None):
        """Reset attempt count to 0 so the user can restart from batch 1."""
        instance = self.get_object()
        content_type = ContentType.objects.get_for_model(instance)
        try:
            attempt = UserSetAttempt.objects.get(
                user=request.user,
                content_type=content_type,
                object_id=instance.id
            )
            attempt.attempt_count = 0
            attempt.save()
            return Response({'success': True, 'message': 'Attempt reset to 0'})
        except UserSetAttempt.DoesNotExist:
            return Response({'success': True, 'message': 'No attempt record found'})