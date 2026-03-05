from django.db import models
from django.conf import settings
from ckeditor.fields import RichTextField

class OSCESet(models.Model):
    COURSE_CHOICES = [
        ('medicine', 'Medicine'),
        ('surgery', 'Surgery'),
        ('commed', 'Community Medicine'),
    ]
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="osce_sets",
        null=True,
        blank=True
    )
    title = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    likes = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="liked_osce_sets",
        blank=True
    )
    course_mode = models.CharField(
        max_length=20,
        choices=COURSE_CHOICES,
        # default='commed',
        # help_text="Course mode for this OSCE set"
    )

    def __str__(self):
        return self.title

    def total_likes(self):
        return self.likes.count()

    def user_liked(self, user):
        if not user or user.is_anonymous:
            return False
        return self.likes.filter(id=user.id).exists()


class OSCECard(models.Model):
    """Each OSCE card (image/specimen) in a set"""
    osce_set = models.ForeignKey(
        OSCESet,
        on_delete=models.CASCADE,
        related_name="cards"
    )
    title = models.CharField(max_length=255)
    image = models.URLField(blank=True, null=True)
    explanation = RichTextField(blank=True, null=True)  # Add explanation field

    def __str__(self):
        return self.title


class OSCEQuestion(models.Model):
    """Questions belonging to an OSCE card"""
    card = models.ForeignKey(
        OSCECard,
        on_delete=models.CASCADE,
        related_name="questions"
    )
    question_number = models.PositiveIntegerField()
    text = models.CharField(max_length=500)

    class Meta:
        unique_together = ("card", "question_number")
        ordering = ["question_number"]

    def __str__(self):
        return f"{self.card.title} - Q{self.question_number}"


class OSCEAnswer(models.Model):
    """Answers for each question"""
    question = models.ForeignKey(
        OSCEQuestion,
        on_delete=models.CASCADE,
        related_name="answers"
    )
    text = RichTextField()

    def __str__(self):
        return f"Answer for {self.question}"