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
from .models import *
from .serializers import MCQSetSerializer, UserScoreSerializer, MCQSerializer
from accounts.models import UserSetAttempt
from django.contrib.contenttypes.models import ContentType
from accounts.permissions import HasFreeAccessOrSubscription   # <-- new
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

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


from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import MCQ, ReportedQuestion
import json
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import MCQ, ReportedQuestion

def make_json_safe(obj):
    """Recursively convert any set to list and ensure all values are JSON serializable."""
    if isinstance(obj, set):
        return list(obj)
    if isinstance(obj, dict):
        return {k: make_json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [make_json_safe(item) for item in obj]
    if isinstance(obj, tuple):
        return [make_json_safe(item) for item in obj]
    # If it's a Django model, convert to str (avoid recursion)
    if hasattr(obj, '__class__') and obj.__class__.__module__.startswith('django.db.models'):
        return str(obj)
    return obj
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import MCQ, ReportedQuestion
import json

# ... (other imports) ...
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import MCQ, ReportedQuestion

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def report_mcq(request, mcq_id):
    mcq = get_object_or_404(MCQ, id=mcq_id)
    comment = request.data.get('comment', '')

    # Check for pending report
    if ReportedQuestion.objects.filter(mcq=mcq, user=request.user, status='pending').exists():
        return Response({'error': 'You already have a pending report for this question.'}, status=400)

    # Build snapshot in correct format (MCQ or TF)
    options = mcq.options.all().order_by('key')
    base = {
        "QUESTION": mcq.question or "",
        "OPTION": {opt.key: opt.text for opt in options},
        "TOPIC_CATEGORY": mcq.topic or "",
        "EXPLANATION": mcq.explanation or "",
    }

    if mcq.mcq_type == 'MCQ':
        correct_opt = options.filter(is_correct=True).first()
        base["CORRECT"] = correct_opt.key if correct_opt else ''
    else:  # TF
        base["TRUE"] = [opt.key for opt in options if opt.is_correct]
        base["FALSE"] = [opt.key for opt in options if not opt.is_correct]

    snapshot = {str(mcq.id): base}

    # Save report
    report = ReportedQuestion.objects.create(
        mcq=mcq,
        user=request.user,
        comment=comment,
        snapshot=snapshot
    )
    return Response({'message': 'Report submitted successfully.'}, status=201)


from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import ReportedQuestion
class UserReportedQuestionsView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        reports = ReportedQuestion.objects.filter(
            user=request.user,
            status='reviewed'
        ).order_by('-updated_at')
        data = []
        for r in reports:
            data.append({
                'id': r.id,
                'mcq_id': r.mcq.id,
                'mcq_set_id': r.mcq.mcq_set.id,   # <-- add this
                'question': r.mcq.question,
                'set_title': r.mcq.mcq_set.title,
                'course_mode': r.mcq.mcq_set.course_mode,
                'snapshot': r.snapshot,
                'status': r.status,
                'user_satisfied': r.user_satisfied,
                'resolved_at': r.resolved_at,
                'updated_at': r.updated_at,
            })
        return Response(data)

class ReportFeedbackView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, report_id):
        try:
            report = ReportedQuestion.objects.get(id=report_id, user=request.user)
        except ReportedQuestion.DoesNotExist:
            return Response({'error': 'Report not found'}, status=404)
        satisfied = request.data.get('satisfied')
        if satisfied is None:
            return Response({'error': 'Missing satisfied field'}, status=400)
        report.user_satisfied = satisfied
        report.save(update_fields=['user_satisfied'])
        return Response({'success': True})
from rest_framework.generics import RetrieveAPIView

class SingleMCQView(RetrieveAPIView):
    queryset = MCQ.objects.all()
    serializer_class = MCQSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]