from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
from django.utils import timezone
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.contrib.auth import get_user_model

from .models import Contest
from accounts.utils import send_bulk_html_email_direct

User = get_user_model()

@receiver(post_save, sender=Contest)
def send_new_contest_notification(sender, instance, created, **kwargs):
    """
    Send email to all active users when a new contest is created.
    """
    if not created:
        return

    recipient_emails = list(User.objects.filter(is_active=True).values_list('email', flat=True))
    if not recipient_emails:
        return

    subject = f"New Contest: {instance.title}"
    context = {
        'contest': instance,
        'site_url': settings.FRONTEND_URL.rstrip('/'),
        'now': timezone.now(),
    }

    # Render HTML
    html_message = render_to_string('emails/contest_notify.html', context)

    # Generate plain text version by stripping HTML tags
    plain_message = strip_tags(html_message)

    send_bulk_html_email_direct(
        subject=subject,
        html_message=html_message,
        plain_message=plain_message,
        recipient_list=recipient_emails
    )