# backend/feed/management/commands/sync_feeditem_likes.py
import time
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from feed.models import FeedItem
from flashcards.models import FlashcardSet
from mcqs.models import MCQSet
from osces.models import OSCESet
from notes.models import Note

User = get_user_model()

class Command(BaseCommand):
    help = 'Sync existing likes from content objects to FeedItem liked_by field'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--batch-size',
            type=int,
            default=100,
            help='Number of items to process in each batch (default: 100)'
        )
        parser.add_argument(
            '--content-type',
            type=str,
            choices=['all', 'flashcard_set', 'mcq_set', 'osce_set', 'note'],
            default='all',
            help='Sync specific content type or all (default: all)'
        )

    def handle(self, *args, **options):
        batch_size = options['batch_size']
        content_type = options['content_type']
        
        start_time = time.time()
        
        if content_type == 'all' or content_type == 'flashcard_set':
            self.sync_flashcards(batch_size)
        
        if content_type == 'all' or content_type == 'mcq_set':
            self.sync_mcqs(batch_size)
        
        if content_type == 'all' or content_type == 'osce_set':
            self.sync_osces(batch_size)
        
        if content_type == 'all' or content_type == 'note':
            self.sync_notes(batch_size)
        
        end_time = time.time()
        total_time = end_time - start_time
        
        self.stdout.write(self.style.SUCCESS(
            f'✓ Sync completed in {total_time:.2f} seconds'
        ))

    def sync_flashcards(self, batch_size):
        """Sync FlashcardSet likes to FeedItem"""
        self.stdout.write('Syncing FlashcardSet likes...')
        
        # Get all flashcards with likes
        flashcards = FlashcardSet.objects.filter(likes__isnull=False).distinct()
        total = flashcards.count()
        
        if total == 0:
            self.stdout.write('  No FlashcardSets with likes found.')
            return
        
        self.stdout.write(f'  Found {total} FlashcardSets with likes')
        
        processed = 0
        success = 0
        failed = 0
        
        for i in range(0, total, batch_size):
            batch = flashcards[i:i + batch_size]
            
            for flashcard in batch:
                try:
                    # Get or create FeedItem
                    feed_item, created = FeedItem.objects.get_or_create(
                        content_type='flashcard_set',
                        content_id=flashcard.id,
                        defaults={'user': flashcard.user}
                    )
                    
                    # Update user if FeedItem already existed
                    if not created and feed_item.user != flashcard.user:
                        feed_item.user = flashcard.user
                    
                    # Sync likes
                    users_who_liked = flashcard.likes.all()
                    feed_item.liked_by.set(users_who_liked)
                    
                    # Update counts and score
                    feed_item.likes_count = users_who_liked.count()
                    feed_item.calculate_score()
                    feed_item.save()
                    
                    success += 1
                    
                except Exception as e:
                    failed += 1
                    self.stdout.write(self.style.ERROR(
                        f'  Error syncing flashcard {flashcard.id}: {str(e)}'
                    ))
                
                processed += 1
                
                if processed % 50 == 0 or processed == total:
                    self.stdout.write(f'  Processed: {processed}/{total}')
        
        self.stdout.write(self.style.SUCCESS(
            f'  Flashcard sync complete: {success} succeeded, {failed} failed'
        ))

    def sync_mcqs(self, batch_size):
        """Sync MCQSet likes to FeedItem"""
        self.stdout.write('Syncing MCQSet likes...')
        
        mcqs = MCQSet.objects.filter(likes__isnull=False).distinct()
        total = mcqs.count()
        
        if total == 0:
            self.stdout.write('  No MCSets with likes found.')
            return
        
        self.stdout.write(f'  Found {total} MCSets with likes')
        
        processed = 0
        success = 0
        failed = 0
        
        for i in range(0, total, batch_size):
            batch = mcqs[i:i + batch_size]
            
            for mcq in batch:
                try:
                    feed_item, created = FeedItem.objects.get_or_create(
                        content_type='mcq_set',
                        content_id=mcq.id,
                        defaults={'user': mcq.user}
                    )
                    
                    if not created and feed_item.user != mcq.user:
                        feed_item.user = mcq.user
                    
                    users_who_liked = mcq.likes.all()
                    feed_item.liked_by.set(users_who_liked)
                    
                    feed_item.likes_count = users_who_liked.count()
                    feed_item.calculate_score()
                    feed_item.save()
                    
                    success += 1
                    
                except Exception as e:
                    failed += 1
                    self.stdout.write(self.style.ERROR(
                        f'  Error syncing MCQSet {mcq.id}: {str(e)}'
                    ))
                
                processed += 1
                
                if processed % 50 == 0 or processed == total:
                    self.stdout.write(f'  Processed: {processed}/{total}')
        
        self.stdout.write(self.style.SUCCESS(
            f'  MCQSet sync complete: {success} succeeded, {failed} failed'
        ))

    def sync_osces(self, batch_size):
        """Sync OSCESet likes to FeedItem"""
        self.stdout.write('Syncing OSCESet likes...')
        
        osces = OSCESet.objects.filter(likes__isnull=False).distinct()
        total = osces.count()
        
        if total == 0:
            self.stdout.write('  No OSCESets with likes found.')
            return
        
        self.stdout.write(f'  Found {total} OSCESets with likes')
        
        processed = 0
        success = 0
        failed = 0
        
        for i in range(0, total, batch_size):
            batch = osces[i:i + batch_size]
            
            for osce in batch:
                try:
                    feed_item, created = FeedItem.objects.get_or_create(
                        content_type='osce_set',
                        content_id=osce.id,
                        defaults={'user': osce.user}
                    )
                    
                    if not created and feed_item.user != osce.user:
                        feed_item.user = osce.user
                    
                    users_who_liked = osce.likes.all()
                    feed_item.liked_by.set(users_who_liked)
                    
                    feed_item.likes_count = users_who_liked.count()
                    feed_item.calculate_score()
                    feed_item.save()
                    
                    success += 1
                    
                except Exception as e:
                    failed += 1
                    self.stdout.write(self.style.ERROR(
                        f'  Error syncing OSCESet {osce.id}: {str(e)}'
                    ))
                
                processed += 1
                
                if processed % 50 == 0 or processed == total:
                    self.stdout.write(f'  Processed: {processed}/{total}')
        
        self.stdout.write(self.style.SUCCESS(
            f'  OSCESet sync complete: {success} succeeded, {failed} failed'
        ))

    def sync_notes(self, batch_size):
        """Sync Note likes to FeedItem (only public notes)"""
        self.stdout.write('Syncing Note likes...')
        
        # Only sync public notes
        notes = Note.objects.filter(
            visibility='public',
            likes__isnull=False
        ).distinct()
        total = notes.count()
        
        if total == 0:
            self.stdout.write('  No public Notes with likes found.')
            return
        
        self.stdout.write(f'  Found {total} public Notes with likes')
        
        processed = 0
        success = 0
        failed = 0
        skipped = 0
        
        for i in range(0, total, batch_size):
            batch = notes[i:i + batch_size]
            
            for note in batch:
                try:
                    # Skip if not public (though filtered above, double-check)
                    if note.visibility != 'public':
                        skipped += 1
                        continue
                    
                    feed_item, created = FeedItem.objects.get_or_create(
                        content_type='note',
                        content_id=note.id,
                        defaults={'user': note.author}
                    )
                    
                    if not created and feed_item.user != note.author:
                        feed_item.user = note.author
                    
                    users_who_liked = note.likes.all()
                    feed_item.liked_by.set(users_who_liked)
                    
                    feed_item.likes_count = users_who_liked.count()
                    feed_item.calculate_score()
                    feed_item.save()
                    
                    success += 1
                    
                except Exception as e:
                    failed += 1
                    self.stdout.write(self.style.ERROR(
                        f'  Error syncing Note {note.id}: {str(e)}'
                    ))
                
                processed += 1
                
                if processed % 50 == 0 or processed == total:
                    self.stdout.write(f'  Processed: {processed}/{total}')
        
        stats = f'  Note sync complete: {success} succeeded, {failed} failed'
        if skipped > 0:
            stats += f', {skipped} skipped (not public)'
        self.stdout.write(self.style.SUCCESS(stats))