import hashlib
import json
from django.db import models
from django.conf import settings
from django.utils import timezone

class MCQSet(models.Model):
    COURSE_CHOICES = [
        ('medicine', 'Medicine'),
        ('surgery', 'Surgery'),
        ('commed', 'Community Medicine'),
    ]
    title = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    likes = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="liked_mcqsets",
        blank=True
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mcq_sets"
    )
    course_mode = models.CharField(
        max_length=20,
        choices=COURSE_CHOICES,
    )

    class Meta:
        ordering = ['title']

    def __str__(self):
        return self.title

    def total_likes(self):
        return self.likes.count()


class MCQ(models.Model):
    QUESTION_TYPES = [
        ('TF', 'True/False'),
        ('MCQ', 'Multiple Choice'),
    ]
    mcq_set = models.ForeignKey(MCQSet, on_delete=models.CASCADE, related_name='mcqs')
    question = models.TextField()
    mcq_type = models.CharField(max_length=10, choices=QUESTION_TYPES)
    explanation = models.TextField(blank=True, null=True)
    topic = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Topic or category (e.g., Epidemiology, Communicable Diseases)"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    # fingerprint for exact matching across sets
    fingerprint = models.CharField(max_length=64, blank=True, editable=False, db_index=True)

    def save(self, *args, **kwargs):
        self.update_fingerprint()
        super().save(*args, **kwargs)

    def update_fingerprint(self):
        """Compute SHA-256 hash based on question, type, and sorted options."""
        if not self.pk:
            # Not saved yet; can't access reverse relation. Will be recomputed after options are saved.
            self.fingerprint = ''
            return
        options_data = []
        for opt in self.options.order_by('key'):
            options_data.append({
                'key': opt.key,
                'text': opt.text,
                'is_correct': opt.is_correct,
            })
        data = {
            'question': self.question,
            'mcq_type': self.mcq_type,
            'options': options_data,
        }
        json_str = json.dumps(data, sort_keys=True, ensure_ascii=False)
        self.fingerprint = hashlib.sha256(json_str.encode('utf-8')).hexdigest()

    def get_siblings(self, course_mode=None):
        """Return MCQs with same fingerprint, optionally filtered by course_mode."""
        qs = MCQ.objects.filter(fingerprint=self.fingerprint).exclude(id=self.id)
        if course_mode:
            qs = qs.filter(mcq_set__course_mode=course_mode)
        return qs

    def get_sibling_details(self, course_mode=None):
        """Return a list of sibling info: (set_title, mcq_id, question_preview)."""
        siblings = self.get_siblings(course_mode=course_mode)
        return [
            {
                'id': s.id,
                'set_title': s.mcq_set.title,
                'course_mode': s.mcq_set.course_mode,
                'question_preview': s.question[:50] + '...' if len(s.question) > 50 else s.question
            }
            for s in siblings
        ]

    def __str__(self):
        return self.question[:50]


class Option(models.Model):
    mcq = models.ForeignKey(MCQ, on_delete=models.CASCADE, related_name='options')
    key = models.CharField(max_length=5)
    text = models.TextField()
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        mcq_id = self.mcq.id if self.mcq else "None"
        return f"MCQ {mcq_id} - {self.key}"


class UserScore(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='scores')
    mcq_set = models.ForeignKey(MCQSet, on_delete=models.CASCADE)
    score = models.FloatField()
    total_score = models.FloatField()
    taken_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.mcq_set.title} - {self.score}"


class ReportedQuestion(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('reviewed', 'Reviewed'),
        ('resolved', 'Resolved'),
        ('archived', 'Archived'),   # Add this
    ]
    mcq = models.ForeignKey(MCQ, on_delete=models.CASCADE, related_name='reports')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    comment = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_reports'
    )
    user_satisfied = models.BooleanField(null=True, blank=True)  # for feedback

    # snapshot in exact JSON format (like upload format)
    snapshot = models.JSONField(
        default=dict,
        editable=False,
        help_text="Snapshot of the question in upload JSON format at report time."
    )

    class Meta:
        # unique_together = ('mcq', 'user')
        pass

    def __str__(self):
        return f"{self.user.username} reported MCQ #{self.mcq.id}"