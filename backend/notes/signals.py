from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Note
from feed.models import FeedItem

@receiver(post_save, sender=Note)
def create_note_feed_item(sender, instance, created, **kwargs):
    """Create a FeedItem when a new Note is created."""
    if created:
        FeedItem.objects.create(
            content_type='note',
            content_id=instance.id,
            user=instance.user,
            course_mode=instance.course_mode,
            likes_count=0,
            score=0.0
        )
    else:
        # Update feed item if course_mode changes
        try:
            feed_item = FeedItem.objects.get(
                content_type='note',
                content_id=instance.id
            )
            if feed_item.course_mode != instance.course_mode:
                feed_item.course_mode = instance.course_mode
                feed_item.save()
        except FeedItem.DoesNotExist:
            # Create if missing (should not happen, but safe)
            FeedItem.objects.create(
                content_type='note',
                content_id=instance.id,
                user=instance.user,
                course_mode=instance.course_mode,
                likes_count=0,
                score=0.0
            )

@receiver(post_delete, sender=Note)
def delete_note_feed_item(sender, instance, **kwargs):
    """Delete the corresponding FeedItem when a Note is deleted."""
    FeedItem.objects.filter(
        content_type='note',
        content_id=instance.id
    ).delete()