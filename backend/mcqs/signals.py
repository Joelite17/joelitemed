from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import MCQSet
from feed.models import FeedItem

@receiver(post_save, sender=MCQSet)
def create_mcqset_feed_item(sender, instance, created, **kwargs):
    if created:
        FeedItem.objects.create(
            content_type='mcq_set',
            content_id=instance.id,
            user=instance.user,
            course_mode=instance.course_mode,
            likes_count=0,
            score=0.0
        )
    else:
        # If the set is updated (e.g., course_mode changes), update the feed item
        try:
            feed_item = FeedItem.objects.get(content_type='mcq_set', content_id=instance.id)
            feed_item.course_mode = instance.course_mode
            feed_item.save()
        except FeedItem.DoesNotExist:
            pass