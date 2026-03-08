import random
import logging
from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError
from mcqs.models import MCQSet, MCQ

logger = logging.getLogger(__name__)

class Contest(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('scheduled', 'Scheduled'),
        ('active', 'Active'),
        ('ended', 'Ended'),
        ('cancelled', 'Cancelled'),
    ]
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    mcq_set = models.ForeignKey(
        MCQSet,
        on_delete=models.CASCADE,
        related_name='contests'
    )
    total_questions = models.PositiveIntegerField(
        help_text="Number of questions to include in the contest (randomly selected from the set)"
    )
    start_time = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField(help_text="Duration in minutes")
    end_time = models.DateTimeField(editable=False, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    prize_description = models.TextField(blank=True, help_text="Describe prizes for winners")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Pre‑selected question IDs for all participants
    selected_question_ids = models.JSONField(
        default=list,
        blank=True,
        help_text="Pre‑selected MCQ IDs for this contest (all users get the same set)."
    )

    # Snapshot of question data for permanent viewing
    questions_snapshot = models.JSONField(
        default=dict,
        blank=True,
        help_text="Snapshot of the full question data (question text, options, explanation)."
    )

    class Meta:
        ordering = ['-start_time']

    def __str__(self):
        return self.title

    def clean(self):
        """Validate that total_questions does not exceed available questions in the set."""
        if self.mcq_set_id and self.total_questions > self.mcq_set.mcqs.count():
            raise ValidationError({
                'total_questions': (
                    f"Total questions ({self.total_questions}) cannot exceed the number of questions "
                    f"in the selected MCQ set ({self.mcq_set.mcqs.count()})."
                )
            })

    def save(self, *args, **kwargs):
        # Ensure JSON fields are proper types (they should be, but double-check)
        if self.selected_question_ids is None:
            self.selected_question_ids = []
        if self.questions_snapshot is None:
            self.questions_snapshot = {}

        # Only generate questions if we have a valid mcq_set and the contest is not a draft
        if self.mcq_set_id and self.status in ['scheduled', 'active'] and not self.selected_question_ids:
            try:
                self.selected_question_ids = self.get_random_question_ids()
            except ValidationError as e:
                # Re-raise ValidationError so the admin shows a user‑friendly message
                raise ValidationError(f"Could not generate questions: {e.message}")
            except Exception as e:
                logger.error(f"Unexpected error generating questions for contest {self.pk}: {e}")
                raise ValidationError("Failed to generate questions. Please check the selected MCQ set.")

        # Build snapshot if we have selected_question_ids but no snapshot yet
        if self.selected_question_ids and not self.questions_snapshot:
            try:
                self.questions_snapshot = self._build_questions_snapshot()
            except Exception as e:
                logger.error(f"Failed to build questions snapshot for contest {self.pk}: {e}")
                raise ValidationError("Failed to build question snapshot. Please try again.")

        # Calculate end_time if start_time and duration are provided
        if self.start_time and self.duration_minutes:
            self.end_time = self.start_time + timezone.timedelta(minutes=self.duration_minutes)

        super().save(*args, **kwargs)

    def is_active(self):
        now = timezone.now()
        return self.start_time <= now <= self.end_time and self.status in ['scheduled', 'active']

    def participants_count(self):
        return self.participations.filter(status='completed').count()

    def get_random_question_ids(self):
        """Return a list of random MCQ IDs from the set, length = total_questions."""
        if not self.mcq_set_id:
            raise ValidationError("No MCQ set selected for this contest.")
        all_ids = list(self.mcq_set.mcqs.values_list('id', flat=True))
        if len(all_ids) < self.total_questions:
            raise ValidationError(
                f"Not enough questions in the selected MCQ set. "
                f"Available: {len(all_ids)}, requested: {self.total_questions}."
            )
        return random.sample(all_ids, self.total_questions)

    def _build_questions_snapshot(self):
        """Build a dict mapping question_id -> full question data."""
        if not self.selected_question_ids:
            return {}
        mcqs = MCQ.objects.filter(id__in=self.selected_question_ids).prefetch_related('options')
        snapshot = {}
        for mcq in mcqs:
            snapshot[str(mcq.id)] = {
                'id': mcq.id,
                'question': mcq.question,
                'explanation': mcq.explanation,
                'mcq_type': mcq.mcq_type,
                'options': [
                    {'key': opt.key, 'text': opt.text, 'is_correct': opt.is_correct}
                    for opt in mcq.options.all()
                ]
            }
        return snapshot


class ContestParticipation(models.Model):
    STATUS_CHOICES = [
        ('started', 'Started'),
        ('completed', 'Completed'),
        ('abandoned', 'Abandoned'),
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='contest_participations')
    contest = models.ForeignKey(Contest, on_delete=models.CASCADE, related_name='participations')
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    score = models.FloatField(default=0)
    total_score = models.FloatField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='started')
    selected_question_ids = models.JSONField(default=list, help_text="List of MCQ IDs selected for this participation")
    answers = models.JSONField(
        default=dict,
        help_text="Mapping of question_id -> {option_key: 'T'/'F'/null}"
    )

    class Meta:
        unique_together = ('user', 'contest')
        ordering = ['-started_at']

    def __str__(self):
        # Safely handle the representation – do NOT call .rstrip() on anything that could be a list.
        return f"{self.user.username} - {self.contest.title}"

    def calculate_score(self):
        """Calculate per‑option True/False score: +1 correct, –0.5 wrong, 0 unanswered."""
        correct_count = 0
        total_possible = 0

        contest = self.contest
        snapshot = contest.questions_snapshot

        for qid in self.selected_question_ids:
            qid_str = str(qid)
            q_data = snapshot.get(qid_str) if snapshot else None
            if not q_data:
                continue
            options = q_data['options']
            total_possible += len(options)

            user_answers = self.answers.get(qid_str, {})

            for opt in options:
                opt_key = opt['key']
                correct_tf = "T" if opt['is_correct'] else "F"
                user_tf = user_answers.get(opt_key)

                if user_tf is None:
                    continue
                if user_tf == correct_tf:
                    correct_count += 1
                else:
                    correct_count -= 0.5

        self.score = correct_count
        self.total_score = total_possible