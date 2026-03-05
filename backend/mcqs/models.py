from django.db import models
from django.conf import settings

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
        # default='commed',
        # help_text="Course mode for this MCQ set"
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