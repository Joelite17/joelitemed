from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import FlashcardSet
from feed.models import FeedItem

@receiver(post_save, sender=FlashcardSet)
def create_flashcard_feed_item(sender, instance, created, **kwargs):
    """
    Create a FeedItem when a new FlashcardSet is created.
    If the set is updated, sync the course_mode to the feed item.
    """
    if created:
        FeedItem.objects.create(
            content_type='flashcard_set',
            content_id=instance.id,
            user=instance.user,
            course_mode=instance.course_mode,
            likes_count=0,
            score=0.0
        )
    else:
        # Update feed item if course_mode changed
        try:
            feed_item = FeedItem.objects.get(
                content_type='flashcard_set',
                content_id=instance.id
            )
            if feed_item.course_mode != instance.course_mode:
                feed_item.course_mode = instance.course_mode
                feed_item.save()
        except FeedItem.DoesNotExist:
            # If feed item missing for some reason, create it
            FeedItem.objects.create(
                content_type='flashcard_set',
                content_id=instance.id,
                user=instance.user,
                course_mode=instance.course_mode,
                likes_count=0,
                score=0.0
            )

from django.db.models.signals import post_delete

@receiver(post_delete, sender=FlashcardSet)
def delete_flashcard_feed_item(sender, instance, **kwargs):
    FeedItem.objects.filter(
        content_type='flashcard_set',
        content_id=instance.id
    ).delete()