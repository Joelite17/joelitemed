from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class FeedItem(models.Model):
    COURSE_CHOICES = [
        ('medicine', 'Medicine'),
        ('surgery', 'Surgery'),
        ('commed', 'Community Medicine'),
    ]
    CONTENT_TYPES = [
        ('flashcard_set', 'Flashcard Set'),
        ('mcq_set', 'MCQ Set'),
        ('osce_set', 'OSCE Set'),
        ('note', 'Note'),
    ]
    
    content_type = models.CharField(max_length=20, choices=CONTENT_TYPES)
    content_id = models.PositiveIntegerField()
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='feed_items')
    
    liked_by = models.ManyToManyField(
        User, 
        related_name='liked_feed_items',
        blank=True,
        help_text="Users who have liked this content"
    )
    likes_count = models.PositiveIntegerField(default=0)
    score = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    course_mode = models.CharField(
        max_length=20,
        choices=COURSE_CHOICES,
        # default='commed',
        # help_text="Course mode of the content"
    )

    class Meta:
        indexes = [
            models.Index(fields=['content_type', 'content_id']),
            models.Index(fields=['created_at']),
            models.Index(fields=['likes_count']),
            models.Index(fields=['score']),
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['course_mode']),   # added for filtering
        ]
        unique_together = ['content_type', 'content_id']
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.content_type} #{self.content_id} by {self.user.username}"

    def get_content_type_display(self):
        return dict(self.CONTENT_TYPES).get(self.content_type, self.content_type)

    def update_likes_count(self):
        self.likes_count = self.liked_by.count()
        self.save(update_fields=['likes_count', 'updated_at'])

    def calculate_score(self):
        from django.utils.timezone import now
        import math
        time_since_creation = (now() - self.created_at).total_seconds() / 3600
        if time_since_creation > 0:
            self.score = self.likes_count / math.log(time_since_creation + 2)
        else:
            self.score = self.likes_count
        self.save(update_fields=['score', 'updated_at'])
        return self.score