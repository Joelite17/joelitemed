import os
import base64
import pickle
import time
import random
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

from django.conf import settings
from django.template.loader import render_to_string
from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from decouple import config
import logging
logger = logging.getLogger(__name__)

# ----------------------------------------------------------------------
# Gmail API Email Sending (Single)
# ----------------------------------------------------------------------
def send_email_via_gmail(to_email, subject, plain_message, html_message=None):
    """
    Send email using Gmail API.
    Reads TOKEN_PICKLE and DEFAULT_FROM_EMAIL from .env or Railway.
    """
    token_env = config("TOKEN_PICKLE")
    default_from = settings.DEFAULT_FROM_EMAIL

    creds = pickle.loads(base64.b64decode(token_env))

    # Refresh token if expired
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        # Optionally update token_env if you want to store refreshed token

    service = build('gmail', 'v1', credentials=creds)

    # Build the email
    if html_message:
        msg = MIMEMultipart('alternative')
        msg.attach(MIMEText(plain_message, 'plain'))
        msg.attach(MIMEText(html_message, 'html'))
    else:
        msg = MIMEText(plain_message, 'plain')

    msg['to'] = to_email
    msg['from'] = default_from
    msg['subject'] = subject

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    body = {'raw': raw}

    sent = service.users().messages().send(userId='me', body=body).execute()
    return sent

# ----------------------------------------------------------------------
# Password Reset Email
# ----------------------------------------------------------------------

def send_password_reset_email(user, token):
    reset_url = f"{settings.FRONTEND_URL}/reset-password?uid={user.pk}&token={token}"
    subject = "Reset your password"
    plain_message = (
        f"Hi {user.username},\n\n"
        f"Reset your password by visiting the following link:\n\n"
        f"{reset_url}\n\n"
        f"If you didn't request this, you can ignore this email."
    )
    send_email_via_gmail(user.email, subject, plain_message)

# ----------------------------------------------------------------------
# HTML Email (Single recipient)
# ----------------------------------------------------------------------

def send_html_email(subject, template_name, context, recipient_list):
    """
    Send an HTML email to a single recipient (kept for backward compatibility).
    For multiple recipients, use send_bulk_html_email instead.
    """
    if not recipient_list:
        return
    html_message = render_to_string(template_name, context)
    plain_message = f"Please enable HTML to view this email, or visit {settings.FRONTEND_URL}"
    send_email_via_gmail(recipient_list[0], subject, plain_message, html_message)

# ----------------------------------------------------------------------
# Bulk Email with Multithreading
# ----------------------------------------------------------------------

def send_bulk_html_email_direct(subject, html_message, plain_message, recipient_list, max_workers=10):
    """
    Send bulk HTML emails using pre‑rendered messages.
    """
    if not recipient_list:
        return

    def send_one(email):
        time.sleep(random.uniform(0.1, 0.3))
        try:
            send_email_via_gmail(email, subject, plain_message, html_message)
            return email, True, None
        except Exception as e:
            return email, False, str(e)

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(send_one, email) for email in recipient_list]
        for future in as_completed(futures):
            email, success, error = future.result()
            if success:
                logger.info(f"✅ Sent contest notification to {email}")
            else:
                logger.error(f"❌ Failed to send to {email}: {error}")

# ----------------------------------------------------------------------
# Existing utility functions (unchanged)
# ----------------------------------------------------------------------

def get_next_items_for_user(user, set_obj, item_queryset, items_per_set=10):
    """
    Get the next batch of items for a user based on their attempt count.
    DOES NOT wrap around when reaching the end. Returns fewer than items_per_set
    if that's all that's left, or an empty list when the entire set is completed.
    """
    if not user or not user.is_authenticated:
        # Unauthenticated users always see the first items
        items = list(item_queryset.order_by('id'))
        return items[:items_per_set]

    from .models import UserSetAttempt
    content_type = ContentType.objects.get_for_model(set_obj.__class__)

    try:
        attempt = UserSetAttempt.objects.get(
            user=user,
            content_type=content_type,
            object_id=set_obj.id
        )
        attempt_count = attempt.attempt_count
    except UserSetAttempt.DoesNotExist:
        attempt_count = 0

    all_items = list(item_queryset.order_by('id'))
    total_items = len(all_items)

    if total_items == 0:
        return []

    # Start index for this batch
    batch_start = attempt_count * items_per_set

    # If we've already seen every item, return empty list (set completed)
    if batch_start >= total_items:
        return []

    batch_end = min(batch_start + items_per_set, total_items)
    return all_items[batch_start:batch_end]


def get_user_progress(user, set_obj, item_queryset, items_per_set=10):
    """
    Return progress stats for the current user on this set.
    - attempt_count: number of batches completed
    - total_items: total cards in the set
    - items_per_set: batch size
    - current_batch: 1-based index of the batch the user is about to take
    - total_batches: total number of full batches (ceil division)
    - completed_batches: number of fully completed batches
    - progress_percentage: (completed_batches / total_batches) * 100
    - has_completed: whether all items have been seen (no more batches)
    """
    if not user or not user.is_authenticated:
        total_items = item_queryset.count()
        total_batches = max(1, (total_items + items_per_set - 1) // items_per_set)
        return {
            'attempt_count': 0,
            'total_items': total_items,
            'items_per_set': items_per_set,
            'current_batch': 1,
            'total_batches': total_batches,
            'progress_percentage': 0,
            'has_completed': False,
            'completed_batches': 0
        }

    from .models import UserSetAttempt
    content_type = ContentType.objects.get_for_model(set_obj.__class__)

    try:
        attempt = UserSetAttempt.objects.get(
            user=user,
            content_type=content_type,
            object_id=set_obj.id
        )
        attempt_count = attempt.attempt_count
    except UserSetAttempt.DoesNotExist:
        attempt_count = 0

    total_items = item_queryset.count()
    total_batches = (total_items + items_per_set - 1) // items_per_set  # ceil division
    if total_batches == 0:
        total_batches = 1

    # Current batch (1‑based) – the next batch to be taken
    current_batch = min(attempt_count + 1, total_batches)

    # Completed batches = attempt_count, but cannot exceed total_batches
    completed_batches = min(attempt_count, total_batches)

    progress_percentage = (completed_batches / total_batches) * 100

    has_completed = attempt_count >= total_batches

    return {
        'attempt_count': attempt_count,
        'total_items': total_items,
        'items_per_set': items_per_set,
        'current_batch': current_batch,
        'completed_batches': completed_batches,
        'total_batches': total_batches,
        'progress_percentage': progress_percentage,
        'has_completed': has_completed
    }


def increment_attempt_count(user, set_obj):
    """
    Increment attempt count ONLY when the user completes a batch.
    """
    if not user or not user.is_authenticated:
        return 0

    from .models import UserSetAttempt
    content_type = ContentType.objects.get_for_model(set_obj.__class__)

    with transaction.atomic():
        attempt, created = UserSetAttempt.objects.get_or_create(
            user=user,
            content_type=content_type,
            object_id=set_obj.id,
            defaults={'attempt_count': 0}
        )
        attempt.attempt_count += 1
        attempt.last_attempted = datetime.now()
        attempt.save()

    return attempt.attempt_count