# backend/feed/signals.py
from django.db.models.signals import m2m_changed, post_delete, post_save
from django.dispatch import receiver
from django.contrib.contenttypes.models import ContentType
from .models import FeedItem
from flashcards.models import FlashcardSet
from mcqs.models import MCQSet
from osces.models import OSCESet
from notes.models import Note  # ✅ Import Note model

# ============ CREATION SIGNALS ============
@receiver(post_save, sender=FlashcardSet)
def create_flashcard_feed_item(sender, instance, created, **kwargs):
    """Create FeedItem when FlashcardSet is created"""
    if created:
        FeedItem.objects.get_or_create(
            content_type='flashcard_set',
            content_id=instance.id,
            defaults={'user': instance.user}
        )

@receiver(post_save, sender=MCQSet)
def create_mcq_feed_item(sender, instance, created, **kwargs):
    """Create FeedItem when MCQSet is created"""
    if created:
        FeedItem.objects.get_or_create(
            content_type='mcq_set',
            content_id=instance.id,
            defaults={'user': instance.user}
        )

@receiver(post_save, sender=OSCESet)
def create_osce_feed_item(sender, instance, created, **kwargs):
    """Create FeedItem when OSCESet is created"""
    if created:
        FeedItem.objects.get_or_create(
            content_type='osce_set',
            content_id=instance.id,
            defaults={'user': instance.user}
        )

# ✅ ADD THIS: Signal to create FeedItem when a Note is created/updated
@receiver(post_save, sender=Note)
def create_or_update_note_feed_item(sender, instance, created, **kwargs):
    """Create or update FeedItem when a Note is saved"""
    # Only create/update feed items for public notes
    if instance.visibility == 'public':
        feed_item, created = FeedItem.objects.get_or_create(
            content_type='note',
            content_id=instance.id,
            defaults={
                'user': instance.author,
                'likes_count': instance.likes.count(),
            }
        )
        
        if not created:
            # Update existing feed item
            feed_item.user = instance.author
            feed_item.likes_count = instance.likes.count()
            feed_item.save()
    else:
        # If note is not public, delete the feed item if it exists
        FeedItem.objects.filter(content_type='note', content_id=instance.id).delete()

# ============ LIKE UPDATE SIGNALS ============
@receiver(m2m_changed, sender=FlashcardSet.likes.through)
def update_flashcard_feed_likes(sender, instance, action, **kwargs):
    """Update FeedItem when FlashcardSet likes change"""
    if action in ['post_add', 'post_remove']:
        feed_item = FeedItem.objects.filter(
            content_type='flashcard_set',
            content_id=instance.id
        ).first()
        
        if feed_item:
            feed_item.likes_count = instance.likes.count()
            feed_item.save()

@receiver(m2m_changed, sender=MCQSet.likes.through)
def update_mcq_feed_likes(sender, instance, action, **kwargs):
    """Update FeedItem when MCQSet likes change"""
    if action in ['post_add', 'post_remove']:
        feed_item = FeedItem.objects.filter(
            content_type='mcq_set',
            content_id=instance.id
        ).first()
        
        if feed_item:
            feed_item.likes_count = instance.likes.count()
            feed_item.save()

@receiver(m2m_changed, sender=OSCESet.likes.through)
def update_osce_feed_likes(sender, instance, action, **kwargs):
    """Update FeedItem when OSCESet likes change"""
    if action in ['post_add', 'post_remove']:
        feed_item = FeedItem.objects.filter(
            content_type='osce_set',
            content_id=instance.id
        ).first()
        
        if feed_item:
            feed_item.likes_count = instance.likes.count()
            feed_item.save()

# ✅ ADD THIS: Signal for Note likes
@receiver(m2m_changed, sender=Note.likes.through)
def update_note_feed_likes(sender, instance, action, **kwargs):
    """Update FeedItem when Note likes change"""
    if action in ['post_add', 'post_remove']:
        # Only update feed items for public notes
        if instance.visibility == 'public':
            feed_item = FeedItem.objects.filter(
                content_type='note',
                content_id=instance.id
            ).first()
            
            if feed_item:
                feed_item.likes_count = instance.likes.count()
                feed_item.save()

# ============ DELETION SIGNALS ============
@receiver(post_delete, sender=FlashcardSet)
def delete_flashcard_feed_item(sender, instance, **kwargs):
    """Delete FeedItem when FlashcardSet is deleted"""
    FeedItem.objects.filter(content_type='flashcard_set', content_id=instance.id).delete()

@receiver(post_delete, sender=MCQSet)
def delete_mcq_feed_item(sender, instance, **kwargs):
    """Delete FeedItem when MCQSet is deleted"""
    FeedItem.objects.filter(content_type='mcq_set', content_id=instance.id).delete()

@receiver(post_delete, sender=OSCESet)
def delete_osce_feed_item(sender, instance, **kwargs):
    """Delete FeedItem when OSCESet is deleted"""
    FeedItem.objects.filter(content_type='osce_set', content_id=instance.id).delete()

@receiver(post_delete, sender=Note)
def delete_note_feed_item(sender, instance, **kwargs):
    """Delete FeedItem when Note is deleted"""
    FeedItem.objects.filter(content_type='note', content_id=instance.id).delete()