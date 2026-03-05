from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db.models import OuterRef, Subquery, Count, IntegerField, Value
from django.db.models.functions import Coalesce
from .models import Contest, ContestParticipation
from .serializers import (
    ContestListSerializer, ContestDetailSerializer,
    ContestParticipationSerializer, ContestTakeSerializer,
    ContestAnswerReviewSerializer
)
from mcqs.models import MCQ
import logging

logger = logging.getLogger(__name__)

class ContestViewSet(viewsets.ReadOnlyModelViewSet):
    """List and retrieve contests."""
    queryset = Contest.objects.all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ContestDetailSerializer
        return ContestListSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        # Filter by status if provided
        status_param = self.request.query_params.get('status')
        if status_param:
            statuses = status_param.split(',')
            queryset = queryset.filter(status__in=statuses)

        # Filter by course_mode of the linked MCQ set if user is authenticated and has a course_mode
        user = self.request.user
        if user.is_authenticated and user.course_mode:
            queryset = queryset.filter(mcq_set__course_mode=user.course_mode)

        return queryset

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def join(self, request, pk=None):
        """Create or resume a participation for the current user."""
        contest = self.get_object()
        now = timezone.now()
        if not contest.is_active():
            return Response(
                {'error': 'This contest is not active at this time.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        participation, created = ContestParticipation.objects.get_or_create(
            user=request.user,
            contest=contest,
            defaults={'status': 'started'}
        )

        if participation.status == 'completed':
            return Response(
                {'error': 'You have already completed this contest.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if created:
            if not contest.selected_question_ids:
                return Response(
                    {'error': 'This contest does not have any questions selected.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            participation.selected_question_ids = contest.selected_question_ids
            participation.save()

        serializer = ContestTakeSerializer(participation, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class ContestParticipationViewSet(viewsets.GenericViewSet):
    """Handle contest participation actions."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ContestParticipationSerializer

    def get_queryset(self):
        qs = ContestParticipation.objects.filter(user=self.request.user)
        user = self.request.user
        if user.is_authenticated and user.course_mode:
            qs = qs.filter(contest__mcq_set__course_mode=user.course_mode)
        return qs


    def list(self, request):
        base_qs = self.get_queryset().filter(status='completed').select_related('contest')

        # Subquery: count how many completed participants in the same contest have a higher score
        higher_count = ContestParticipation.objects.filter(
            contest=OuterRef('contest'),
            status='completed',
            score__gt=OuterRef('score')
        ).values('contest').annotate(
            count=Count('id')
        ).values('count')

        # Annotate rank = number of higher scores + 1
        base_qs = base_qs.annotate(
            rank=Coalesce(Subquery(higher_count, output_field=IntegerField()), Value(0)) + 1
        )

        # Subquery: total number of completed participants in the contest
        total_count = ContestParticipation.objects.filter(
            contest=OuterRef('contest'),
            status='completed'
        ).values('contest').annotate(
            count=Count('id')
        ).values('count')
        base_qs = base_qs.annotate(
            participants_count=Coalesce(Subquery(total_count, output_field=IntegerField()), Value(0))
        )

        base_qs = base_qs.order_by('-started_at')
        serializer = self.get_serializer(base_qs, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        participation = get_object_or_404(self.get_queryset(), pk=pk)
        serializer = ContestTakeSerializer(participation, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def submit_answer(self, request, pk=None):
        """Submit per‑option answers for a specific question."""
        participation = self.get_object()
        if participation.status != 'started':
            return Response(
                {'error': 'This contest has already been submitted.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        question_id = request.data.get('question_id')
        answers = request.data.get('answers')

        if not question_id or answers is None:
            return Response(
                {'error': 'question_id and answers are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        qid_str = str(question_id)
        selected_ids = [str(id) for id in participation.selected_question_ids]

        if qid_str not in selected_ids:
            return Response(
                {'error': 'Invalid question for this contest.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not isinstance(answers, dict):
            return Response(
                {'error': 'answers must be an object.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        current = participation.answers
        current[qid_str] = answers
        participation.answers = current
        participation.save(update_fields=['answers'])

        return Response({'success': True})

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Finalize the contest, calculate score, mark as completed."""
        participation = self.get_object()
        if participation.status != 'started':
            return Response(
                {'error': 'This contest has already been submitted.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        participation.calculate_score()
        participation.status = 'completed'
        participation.completed_at = timezone.now()
        participation.save()

        serializer = self.get_serializer(participation)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def answers(self, request, pk=None):
        """Retrieve detailed answers for a completed contest."""
        participation = self.get_object()
        if participation.status != 'completed':
            return Response(
                {'error': 'Answers are only available after submitting the contest.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        contest = participation.contest
        snapshot = contest.questions_snapshot
        if not snapshot:
            return Response({
                'detail': 'Questions snapshot not available.',
                'answers': []
            }, status=status.HTTP_200_OK)

        answers_data = []
        for qid in participation.selected_question_ids:
            qid_str = str(qid)
            q_data = snapshot.get(qid_str)
            if not q_data:
                continue

            correct_answers = {}
            for opt in q_data['options']:
                correct_answers[opt['key']] = "T" if opt['is_correct'] else "F"

            user_answers = participation.answers.get(qid_str, {})

            answers_data.append({
                'id': q_data['id'],
                'question': q_data['question'],
                'user_answers': user_answers,
                'correct_answers': correct_answers,
                'options': q_data['options'],
                'explanation': q_data.get('explanation', ''),
                'mcq_type': q_data.get('mcq_type', '')
            })

        serializer = ContestAnswerReviewSerializer(answers_data, many=True)
        return Response(serializer.data)