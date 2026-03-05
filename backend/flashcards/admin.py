import json
from django.contrib import admin
from django import forms
from django.shortcuts import render
from django.urls import path, reverse
from django.contrib import messages
from django.http import HttpResponseRedirect
from django.db import transaction
from .models import FlashcardSet, Flashcard, list_to_html

# ----------------------------------------------------------------------
#  JSON Upload Form (no title field, handles multiple files)
# ----------------------------------------------------------------------
class FlashcardUploadForm(forms.Form):
    overwrite = forms.BooleanField(
        required=False,
        initial=False,
        label='Overwrite existing sets with same title',
        help_text='If checked, any existing set with the same title will be deleted before creating a new one.'
    )

# ----------------------------------------------------------------------
#  Inline for Flashcards
# ----------------------------------------------------------------------
class FlashcardInline(admin.StackedInline):
    model = Flashcard
    extra = 2
    min_num = 1
    fields = ['question', 'answer', 'type', 'code']
    verbose_name = "Flashcard"
    verbose_name_plural = "Flashcards"
    show_change_link = True

# ----------------------------------------------------------------------
#  Flashcard Admin
# ----------------------------------------------------------------------
@admin.register(Flashcard)
class FlashcardAdmin(admin.ModelAdmin):
    list_display = ['question_short', 'flashcard_set', 'type', 'code', 'created_at']
    list_filter = ['flashcard_set', 'type']
    search_fields = ['question', 'code']
    fields = ['flashcard_set', 'question', 'answer', 'type', 'code']

    def question_short(self, obj):
        return obj.question[:50] + ("..." if len(obj.question) > 50 else "")
    question_short.short_description = "Question"

# ----------------------------------------------------------------------
#  FlashcardSet Admin (with JSON upload)
# ----------------------------------------------------------------------
@admin.register(FlashcardSet)
class FlashcardSetAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'created_at', 'flashcard_count', 'course_mode']
    search_fields = ['title', 'user__username']
    list_filter = ['user', 'created_at', 'course_mode']
    inlines = [FlashcardInline]
    change_list_template = "admin/flashcards/flashcardset/change_list.html"

    def flashcard_count(self, obj):
        return obj.cards.count()
    flashcard_count.short_description = "Number of Cards"

    # ------------------------------------------------------------------
    #  Custom URLs
    # ------------------------------------------------------------------
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                'upload-json/',
                self.admin_site.admin_view(self.upload_json),
                name='flashcards_flashcardset_upload_json',
            ),
        ]
        return custom_urls + urls

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context['upload_json_url'] = reverse('admin:flashcards_flashcardset_upload_json')
        return super().changelist_view(request, extra_context=extra_context)

    # ------------------------------------------------------------------
    #  JSON Upload Handler (Multiple Files)
    # ------------------------------------------------------------------
    def upload_json(self, request):
        if request.method == 'POST':
            form = FlashcardUploadForm(request.POST)
            if form.is_valid():
                files = request.FILES.getlist('json_files')
                if not files:
                    messages.error(request, "No files selected.")
                else:
                    results = []
                    for f in files:
                        try:
                            json_data = json.load(f)
                            overwrite = form.cleaned_data['overwrite']
                            result = self.process_json_data(
                                json_data, overwrite, request.user, filename=f.name
                            )
                            results.append(result)
                        except json.JSONDecodeError as e:
                            results.append({'success': False, 'message': f"Invalid JSON in {f.name}: {str(e)}"})
                        except Exception as e:
                            results.append({'success': False, 'message': f"Error processing {f.name}: {str(e)}"})

                    # Build summary message
                    successes = [r for r in results if r['success']]
                    errors = [r for r in results if not r['success']]

                    if successes:
                        msg_lines = [f"✅ Successfully created {len(successes)} set(s):"]
                        for s in successes:
                            line = (f"  • {s.get('filename', '?')} → "
                                    f"Title: '{s.get('title', 'Untitled')}', "
                                    f"Course: {s.get('course_mode', '?')}, "
                                    f"Cards: {s.get('cards_created', 0)}")
                            msg_lines.append(line)
                        messages.success(request, "\n".join(msg_lines))

                    if errors:
                        for err in errors:
                            messages.error(request, err['message'])

                    if not successes and not errors:
                        messages.warning(request, "No files processed.")

                    return HttpResponseRedirect('..')
        else:
            form = FlashcardUploadForm()

        context = {
            'form': form,
            'title': 'Upload Flashcard JSON',
            'opts': self.model._meta,
            'media': self.media,
            'has_permission': True,
        }
        return render(request, 'admin/flashcard_upload_json.html', context)

    # ------------------------------------------------------------------
    #  Core processing logic (detects format)
    # ------------------------------------------------------------------
    def process_json_data(self, json_data, overwrite, user, filename=None):
        """
        Convert JSON to flashcard set(s). Handles both old format (dict of cards)
        and new format (list with metadata).
        Returns dict with success, message, title, cards_created, course_mode, filename.
        """
        try:
            with transaction.atomic():
                if isinstance(json_data, list) and len(json_data) >= 2 and 'META_DATA' in json_data[0]:
                    # New format: [ {META_DATA}, {cards...} ]
                    return self._process_new_format(json_data, overwrite, user, filename)
                elif isinstance(json_data, dict):
                    # Old format: dict of cards (keys like "1", "2", ...)
                    return self._process_old_format(json_data, overwrite, user, filename)
                else:
                    raise ValueError("Unrecognized JSON structure")
        except Exception as e:
            return {'success': False, 'message': f"Failed: {str(e)}"}

    # ------------------------------------------------------------------
    #  New format processor (array with metadata)
    # ------------------------------------------------------------------
    def _process_new_format(self, json_list, overwrite, user, filename):
        meta = json_list[0]['META_DATA']

        # Determine set title from metadata (fallback to filename)
        final_title = meta.get('TITLE', '').strip()
        if not final_title:
            final_title = filename.rsplit('.', 1)[0] if filename else 'Untitled Set'

        # Map course mode
        course_map = {
            'MEDICINE': 'medicine',
            'SURGERY': 'surgery',
            'COMMUNITY MEDICINE': 'commed',
        }
        course_mode = course_map.get(meta.get('COURSE', '').upper(), 'commed')

        if overwrite:
            FlashcardSet.objects.filter(title=final_title).delete()

        flashcard_set = FlashcardSet.objects.create(
            title=final_title,
            user=user,
            course_mode=course_mode
        )

        cards_created = 0
        # Process each subsequent element (each is a card object)
        for elem in json_list[1:]:
            if not isinstance(elem, dict):
                continue
            for card_key, card_data in elem.items():
                if not card_key.isdigit():
                    continue
                question = card_data.get('question', '')
                answer_data = card_data.get('answer', [])
                card_type = card_data.get('type', 'list')
                code = card_data.get('code', '')

                if isinstance(answer_data, list) and len(answer_data) > 0:
                    answer_html = list_to_html(answer_data, wrap_in_ol=True)
                else:
                    answer_html = answer_data if isinstance(answer_data, str) else ''

                Flashcard.objects.create(
                    flashcard_set=flashcard_set,
                    question=question,
                    answer=answer_html,
                    type=card_type,
                    code=code
                )
                cards_created += 1

        return {
            'success': True,
            'filename': filename,
            'title': final_title,
            'course_mode': course_mode,
            'cards_created': cards_created,
        }

    # ------------------------------------------------------------------
    #  Old format processor (backward compatibility)
    # ------------------------------------------------------------------
    def _process_old_format(self, json_dict, overwrite, user, filename):
        # Use filename as title (without extension)
        if filename:
            final_title = filename.rsplit('.', 1)[0]
        else:
            final_title = 'Untitled Set'

        if overwrite:
            FlashcardSet.objects.filter(title=final_title).delete()

        flashcard_set = FlashcardSet.objects.create(
            title=final_title,
            user=user,
            course_mode='commed'  # default for legacy
        )

        cards_created = 0
        for card_key, card_data in json_dict.items():
            question = card_data.get('question', '')
            answer_data = card_data.get('answer', [])
            card_type = card_data.get('type', 'list')
            code = card_data.get('code', '')

            if isinstance(answer_data, list) and len(answer_data) > 0:
                answer_html = list_to_html(answer_data, wrap_in_ol=True)
            else:
                answer_html = answer_data if isinstance(answer_data, str) else ''

            Flashcard.objects.create(
                flashcard_set=flashcard_set,
                question=question,
                answer=answer_html,
                type=card_type,
                code=code
            )
            cards_created += 1

        return {
            'success': True,
            'filename': filename,
            'title': final_title,
            'course_mode': 'commed',
            'cards_created': cards_created,
        }