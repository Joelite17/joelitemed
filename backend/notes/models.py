from django.conf import settings
from django.db import models
from ckeditor.fields import RichTextField

class Note(models.Model):
    COURSE_CHOICES = [
        ('medicine', 'Medicine'),
        ('surgery', 'Surgery'),
        ('commed', 'Community Medicine'),
    ]
    VISIBILITY_CHOICES = [
        ("private", "Private"),
        ("public", "Public"),
        ("subscriber", "Subscriber Only"),
    ]

    title = models.CharField(max_length=255)
    content = RichTextField()
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notes",
    )
    visibility = models.CharField(
        max_length=50,
        choices=VISIBILITY_CHOICES,
        default="private",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    likes = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="liked_notes",
        blank=True
    )
    course_mode = models.CharField(
        max_length=20,
        choices=COURSE_CHOICES,
        # default='commed',
        # help_text="Course mode for this note"
    )

    def __str__(self):
        return self.title

    @property
    def author(self):
        return self.user

    def total_likes(self):
        return self.likes.count()

    def user_liked(self, user):
        if not user or user.is_anonymous:
            return False
        return self.likes.filter(id=user.id).exists()