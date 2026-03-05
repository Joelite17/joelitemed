from django.test import TestCase
from django.contrib.auth import get_user_model
from .models import FeedItem

User = get_user_model()

class FeedModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
    
    def test_feed_item_creation(self):
        feed_item = FeedItem.objects.create(
            content_type='flashcard_set',
            content_id=1,
            user=self.user,
            likes_count=5
        )
        self.assertEqual(feed_item.content_type, 'flashcard_set')
        self.assertEqual(feed_item.content_id, 1)
        self.assertEqual(feed_item.likes_count, 5)
        self.assertEqual(str(feed_item), 'flashcard_set #1')

