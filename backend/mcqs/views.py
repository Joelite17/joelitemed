from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from accounts.utils import get_next_items_for_user, increment_attempt_count, get_user_progress
from .models import MCQSet, UserScore
from .serializers import MCQSetSerializer, UserScoreSerializer, MCQSerializer
from accounts.models import UserSetAttempt
from django.contrib.contenttypes.models import ContentType

from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from accounts.utils import get_next_items_for_user, increment_attempt_count, get_user_progress
from .models import MCQSet, UserScore
from .serializers import MCQSetSerializer, UserScoreSerializer, MCQSerializer
from accounts.models import UserSetAttempt
from django.contrib.contenttypes.models import ContentType
from accounts.permissions import HasFreeAccessOrSubscription   # <-- new

class MCQSetViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MCQSet.objects.all().order_by("-created_at")
    serializer_class = MCQSetSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_permissions(self):
        if self.action == 'retrieve':
            return [HasFreeAccessOrSubscription()]
        return super().get_permissions()

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        print("CM", user.course_mode)
        if user.is_authenticated and user.course_mode:
            queryset = queryset.filter(course_mode=user.course_mode)
        return queryset


    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = serializer.data

        # Get next 10 MCQs for this user WITHOUT creating attempt
        mcqs = get_next_items_for_user(
            request.user,
            instance,
            instance.mcqs.all(),
            items_per_set=10
        )
        
        # Get user progress
        progress = get_user_progress(
            request.user,
            instance,
            instance.mcqs.all(),
            items_per_set=10
        )
        
        data["mcqs"] = MCQSerializer(mcqs, many=True).data
        data["progress"] = progress
        
        return Response(data)
 
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def toggle_like(self, request, pk=None):
        mcqset = self.get_object()
        user = request.user
        if mcqset.likes.filter(id=user.id).exists():
            mcqset.likes.remove(user)
            liked = False 
        else:
            mcqset.likes.add(user)
            liked = True
        return Response({
            "liked": liked,
            "likes_count": mcqset.likes.count()
        })
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def increment_attempt(self, request, pk=None):
        """
        Increment attempt count for this set (ONLY when user completes it)
        """
        instance = self.get_object()
        new_count = increment_attempt_count(request.user, instance)
        
        # Get updated progress
        progress = get_user_progress(
            request.user,
            instance,
            instance.mcqs.all(),
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
            instance.mcqs.all(),
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

class UserScoreViewSet(viewsets.ModelViewSet):
    serializer_class = UserScoreSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = UserScore.objects.filter(user=self.request.user).order_by('-taken_at')
        course_mode = self.request.query_params.get('course_mode')
        if course_mode:
            queryset = queryset.filter(mcq_set__course_mode=course_mode)
        return queryset

    def perform_create(self, serializer):
        score_instance = serializer.save(user=self.request.user)
        mcq_set = score_instance.mcq_set
        increment_attempt_count(self.request.user, mcq_set)