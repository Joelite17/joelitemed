from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import OSCESet
from feed.models import FeedItem

@receiver(post_save, sender=OSCESet)
def create_osce_feed_item(sender, instance, created, **kwargs):
    """
    Create a FeedItem when a new OSCESet is created.
    If the set is updated, sync the course_mode to the feed item.
    """
    if created:
        FeedItem.objects.create(
            content_type='osce_set',
            content_id=instance.id,
            user=instance.user,
            course_mode=instance.course_mode,
            likes_count=0,
            score=0.0
        )
    else:
        try:
            feed_item = FeedItem.objects.get(
                content_type='osce_set',
                content_id=instance.id
            )
            if feed_item.course_mode != instance.course_mode:
                feed_item.course_mode = instance.course_mode
                feed_item.save()
        except FeedItem.DoesNotExist:
            # If missing, create it (e.g., if set was created before signals existed)
            FeedItem.objects.create(
                content_type='osce_set',
                content_id=instance.id,
                user=instance.user,
                course_mode=instance.course_mode,
                likes_count=0,
                score=0.0
            )

@receiver(post_delete, sender=OSCESet)
def delete_osce_feed_item(sender, instance, **kwargs):
    """Delete the corresponding FeedItem when an OSCESet is deleted."""
    FeedItem.objects.filter(
        content_type='osce_set',
        content_id=instance.id
    ).delete()