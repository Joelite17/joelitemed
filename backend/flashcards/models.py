from django.db import models
from django.conf import settings
from ckeditor.fields import RichTextField
import re

# ----------------------------------------------------------------------
#  Helper: Convert array or plain text list to HTML <ol><li>
# ----------------------------------------------------------------------
def list_to_html(answer_data, wrap_in_ol=True):
    """
    Convert an array of strings or plain text with numbered lines into HTML.
    - If answer_data is a list: wrap each item in <li> and enclose in <ol>.
    - If answer_data is a string: split by newline, detect numbered items.
    """
    if not answer_data:
        return ""

    # If already HTML, return as is
    if isinstance(answer_data, str) and answer_data.strip().startswith('<'):
        return answer_data

    items = []
    if isinstance(answer_data, list):
        items = answer_data
    else:
        # Plain text: split lines, extract numbered points or just lines
        lines = answer_data.split('\n')
        for line in lines:
            line = line.strip()
            if line:
                # Remove leading number (e.g., "1. " or "1) ")
                numbered = re.sub(r'^\d+[\.\)]\s*', '', line)
                items.append(numbered or line)

    if not items:
        return ""

    # Escape HTML in each item
    items = [i.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;') for i in items]

    if wrap_in_ol:
        lis = ''.join(f'<li>{item}</li>' for item in items)
        return f'<ol class="pl-5 space-y-1">{lis}</ol>'
    else:
        return '<br>'.join(items)

class FlashcardSet(models.Model):
    COURSE_CHOICES = [
        ('medicine', 'Medicine'),
        ('surgery', 'Surgery'),
        ('commed', 'Community Medicine'),
    ]
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="flashcard_sets"
    )
    title = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    likes = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="liked_flashcard_sets",
        blank=True
    )
    course_mode = models.CharField(
        max_length=20,
        choices=COURSE_CHOICES,
        # default='commed',
        # help_text="Course mode for this flashcard set"
    )

    def __str__(self):
        return f"{self.title} ({self.user.username})"

    def total_likes(self):
        return self.likes.count()
    
class Flashcard(models.Model):
    flashcard_set = models.ForeignKey(
        FlashcardSet,
        on_delete=models.CASCADE,
        related_name="cards"
    )
    question = models.CharField(max_length=255)
    answer = RichTextField()   # now stores HTML
    created_at = models.DateTimeField(auto_now_add=True)
    CARD_TYPES = [
        ("plain", "Plain"),
        ("list", "List"),
    ]
    type = models.CharField(max_length=10, choices=CARD_TYPES, default="plain")
    code = models.CharField(max_length=50, blank=True, null=True, help_text="Optional code (e.g., U-01)")

    def __str__(self):
        return self.question

    def save(self, *args, **kwargs):
        # Auto-convert plain text answers to HTML if type is "list"
        if self.type == "list" and self.answer and not self.answer.strip().startswith('<'):
            self.answer = list_to_html(self.answer, wrap_in_ol=True)
        super().save(*args, **kwargs)