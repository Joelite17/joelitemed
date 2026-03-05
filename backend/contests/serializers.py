import logging
from rest_framework import serializers
from .models import Contest, ContestParticipation

logger = logging.getLogger(__name__)

class ContestListSerializer(serializers.ModelSerializer):
    participants_count = serializers.IntegerField(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_active = serializers.SerializerMethodField()

    class Meta:
        model = Contest
        fields = [
            'id', 'title', 'description', 'start_time', 'end_time',
            'duration_minutes', 'total_questions', 'status', 'status_display',
            'is_active', 'participants_count', 'prize_description'
        ]

    def get_is_active(self, obj):
        return obj.is_active()


class ContestDetailSerializer(serializers.ModelSerializer):
    mcq_set_title = serializers.CharField(source='mcq_set.title', read_only=True)
    participants_count = serializers.IntegerField(read_only=True)
    is_active = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Contest
        fields = [
            'id', 'title', 'description', 'mcq_set', 'mcq_set_title',
            'total_questions', 'start_time', 'end_time', 'duration_minutes',
            'status', 'status_display', 'is_active', 'participants_count',
            'prize_description'
        ]

    def get_is_active(self, obj):
        return obj.is_active()


class ContestParticipationSerializer(serializers.ModelSerializer):
    contest_title = serializers.CharField(source='contest.title', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    rank = serializers.IntegerField(read_only=True)
    participants_count = serializers.IntegerField(read_only=True)   # <-- already present
    contest_end_time = serializers.DateTimeField(source='contest.end_time', read_only=True)

    class Meta:
        model = ContestParticipation
        fields = [
            'id', 'user', 'user_username', 'contest', 'contest_title',
            'started_at', 'completed_at', 'score', 'total_score', 'status',
            'status_display', 'rank', 'participants_count', 'contest_end_time'
        ]
        read_only_fields = ['id', 'user', 'started_at', 'completed_at', 'score', 'total_score']


class ContestTakeSerializer(serializers.ModelSerializer):
    questions = serializers.SerializerMethodField()
    contest_title = serializers.CharField(source='contest.title', read_only=True)
    end_time = serializers.DateTimeField(source='contest.end_time', read_only=True)

    class Meta:
        model = ContestParticipation
        fields = [
            'id', 'contest', 'contest_title', 'started_at', 'end_time',
            'score', 'total_score', 'status', 'questions', 'answers'
        ]

    def get_questions(self, obj):
        contest = obj.contest
        if not contest.questions_snapshot:
            return []
        ordered = []
        for qid in obj.selected_question_ids:
            qid_str = str(qid)
            if qid_str in contest.questions_snapshot:
                ordered.append(contest.questions_snapshot[qid_str])
        return ordered


class ContestAnswerReviewSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    question = serializers.CharField()
    user_answers = serializers.DictField(child=serializers.CharField(allow_null=True))
    correct_answers = serializers.DictField(child=serializers.CharField())
    options = serializers.ListField(child=serializers.DictField())
    explanation = serializers.CharField()
    mcq_type = serializers.CharField()