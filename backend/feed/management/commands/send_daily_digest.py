from django.core.management.base import BaseCommand
from django.utils import timezone
from django.conf import settings
from feed.models import FeedItem
from accounts.models import User
from accounts.utils import send_bulk_html_email
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Send a daily digest email of feed items from the last 24 hours to users'

    def handle(self, *args, **options):
        now = timezone.now()
        start_time = now - timedelta(hours=24)
        end_time = now

        feed_items = FeedItem.objects.filter(created_at__range=(start_time, end_time)).order_by('-created_at')

        if not feed_items.exists():
            self.stdout.write("No feed items in the last 24 hours. No email sent.")
            return

        users = User.objects.filter(is_active=True, email_confirmed=True)
        if not users.exists():
            self.stdout.write(self.style.WARNING("No active users with confirmed email. Falling back to all active users."))
            users = User.objects.filter(is_active=True)
            if not users.exists():
                self.stdout.write("No active users found. No email sent.")
                return

        subject = "📬 Your Daily Feed Digest – New Content Available!"
        context = {
            'feed_items': feed_items,
            'site_url': settings.FRONTEND_URL,
            'count': feed_items.count(),
            'now': now,
        }

        email_list = [user.email for user in users]

        # Send using multithreading
        send_bulk_html_email(
            subject=subject,
            template_name='emails/daily_digest.html',
            context=context,
            recipient_list=email_list,
            max_workers=10
        )

        self.stdout.write(self.style.SUCCESS(f"Digest sent to {len(email_list)} users."))