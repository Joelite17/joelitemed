import json
from django.contrib import admin
from django import forms
from django.shortcuts import render
from django.urls import path, reverse
from django.contrib import messages
from django.http import HttpResponseRedirect
from django.db import transaction
from django.utils.html import urlize
import re

from .models import OSCESet, OSCECard, OSCEQuestion, OSCEAnswer

# ----------------------------------------------------------------------
#  Helper: Convert plain text to HTML (RichTextField compatible)
# ----------------------------------------------------------------------
def text_to_html(text, wrap_paragraphs=True):
    """
    Convert plain text to HTML.
    - Escapes HTML special chars
    - Converts URLs to clickable links
    - If wrap_paragraphs=True, wraps paragraphs in <p> tags; otherwise uses <br>
    - Detects unordered lists (- or *) → <ul><li>
    - Detects ordered lists (1., 2., etc.) → <ol><li>
    - Preserves blank lines as paragraph breaks
    """
    if not text:
        return ""
    
    text = str(text)
    text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    text = urlize(text)
    
    lines = text.split('\n')
    output_lines = []
    in_ul = False
    in_ol = False
    list_items = []
    ol_pattern = re.compile(r'^(\d+)[\.\)]\s+(.*)$')
    
    for line in lines:
        stripped = line.strip()
        if stripped == "":
            if in_ul:
                output_lines.append('<ul>')
                output_lines.extend(f'<li>{item}</li>' for item in list_items)
                output_lines.append('</ul>')
                in_ul = False
                list_items = []
            if in_ol:
                output_lines.append('<ol>')
                output_lines.extend(f'<li>{item}</li>' for item in list_items)
                output_lines.append('</ol>')
                in_ol = False
                list_items = []
            if wrap_paragraphs:
                output_lines.append('<p><br></p>')
            else:
                output_lines.append('<br>')
            continue
        
        if stripped.startswith('- ') or stripped.startswith('* '):
            if in_ol:
                output_lines.append('<ol>')
                output_lines.extend(f'<li>{item}</li>' for item in list_items)
                output_lines.append('</ol>')
                in_ol = False
                list_items = []
            if not in_ul:
                if list_items:
                    output_lines.append('<ul>')
                    output_lines.extend(f'<li>{item}</li>' for item in list_items)
                    output_lines.append('</ul>')
                    list_items = []
                in_ul = True
            item_text = stripped[2:].strip()
            list_items.append(item_text)
        elif ol_pattern.match(stripped):
            match = ol_pattern.match(stripped)
            item_text = match.group(2).strip()
            if in_ul:
                output_lines.append('<ul>')
                output_lines.extend(f'<li>{item}</li>' for item in list_items)
                output_lines.append('</ul>')
                in_ul = False
                list_items = []
            if not in_ol:
                if list_items:
                    output_lines.append('<ol>')
                    output_lines.extend(f'<li>{item}</li>' for item in list_items)
                    output_lines.append('</ol>')
                    list_items = []
                in_ol = True
            list_items.append(item_text)
        else:
            if in_ul:
                output_lines.append('<ul>')
                output_lines.extend(f'<li>{item}</li>' for item in list_items)
                output_lines.append('</ul>')
                in_ul = False
                list_items = []
            if in_ol:
                output_lines.append('<ol>')
                output_lines.extend(f'<li>{item}</li>' for item in list_items)
                output_lines.append('</ol>')
                in_ol = False
                list_items = []
            if wrap_paragraphs:
                output_lines.append(f'<p>{stripped}</p>')
            else:
                output_lines.append(stripped)
    
    if in_ul:
        output_lines.append('<ul>')
        output_lines.extend(f'<li>{item}</li>' for item in list_items)
        output_lines.append('</ul>')
    if in_ol:
        output_lines.append('<ol>')
        output_lines.extend(f'<li>{item}</li>' for item in list_items)
        output_lines.append('</ol>')
    
    if wrap_paragraphs:
        return '\n'.join(output_lines)
    else:
        return '<br>\n'.join(output_lines)

# ----------------------------------------------------------------------
#  Form for JSON upload – updated help text
# ----------------------------------------------------------------------
class OSCEUploadForm(forms.Form):
    overwrite = forms.BooleanField(
        required=False,
        initial=False,
        label='Overwrite existing sets with same title',
        help_text='If checked, any existing set with the same title will have its cards replaced (the set ID stays the same).'
    )

# ----------------------------------------------------------------------
#  Inlines
# ----------------------------------------------------------------------
class OSCEAnswerInline(admin.TabularInline):
    model = OSCEAnswer
    extra = 1

class OSCEQuestionInline(admin.TabularInline):
    model = OSCEQuestion
    extra = 1
    fields = ("question_number", "text")
    inlines = [OSCEAnswerInline]

class OSCECardInline(admin.TabularInline):
    model = OSCECard
    extra = 1

# ----------------------------------------------------------------------
#  OSCESet Admin – MODIFIED _process_new_format and _process_old_format
# ----------------------------------------------------------------------
@admin.register(OSCESet)
class OSCESetAdmin(admin.ModelAdmin):
    list_display = ("title", "created_at", "card_count", "course_mode")
    search_fields = ["title"]
    list_filter = ["created_at", "course_mode"]
    inlines = [OSCECardInline]
    change_list_template = "admin/osces/osceset/change_list.html"

    def card_count(self, obj):
        return obj.cards.count()
    card_count.short_description = "Cards"

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                'upload-json/',
                self.admin_site.admin_view(self.upload_json),
                name='osces_osceset_upload_json',
            ),
        ]
        return custom_urls + urls

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context['upload_json_url'] = reverse('admin:osces_osceset_upload_json')
        return super().changelist_view(request, extra_context=extra_context)

    # ------------------------------------------------------------------
    #  JSON Upload Handler (Multiple Files)
    # ------------------------------------------------------------------
    def upload_json(self, request):
        if request.method == 'POST':
            form = OSCEUploadForm(request.POST)
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
            form = OSCEUploadForm()

        context = {
            'form': form,
            'title': 'Upload OSCE JSON',
            'opts': self.model._meta,
            'media': self.media,
            'has_permission': True,
        }
        return render(request, 'admin/osce_upload_json.html', context)

    # ------------------------------------------------------------------
    #  Core processing logic (detects format)
    # ------------------------------------------------------------------
    def process_json_data(self, json_data, overwrite, user, filename=None):
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
    #  New format processor (array with metadata) – MODIFIED
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
            # Find or create set with same title
            osce_set, created = OSCESet.objects.get_or_create(
                title=final_title,
                defaults={'user': user, 'course_mode': course_mode}
            )
            if not created:
                # Set already existed – delete its cards (cascade to questions/answers)
                osce_set.cards.all().delete()
                # Update metadata
                osce_set.user = user
                osce_set.course_mode = course_mode
                osce_set.save()
        else:
            # Always create a new set
            osce_set = OSCESet.objects.create(
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

                # Convert explanation from plain text to HTML
                explanation_html = text_to_html(card_data.get('explanation', ''))

                # Create OSCE card
                card = OSCECard.objects.create(
                    osce_set=osce_set,
                    title=card_data.get('image_name', f'Card {card_key}'),
                    image=card_data.get('image_url') or card_data.get('image', ''),
                    explanation=explanation_html
                )

                # Process questions
                questions = card_data.get('questions', [])
                answers_data = card_data.get('answers', {})

                for question_item in questions:
                    for q_num_str, q_text in question_item.items():
                        try:
                            q_num = int(q_num_str)
                        except ValueError:
                            q_num = len(card.questions.all()) + 1

                        question = OSCEQuestion.objects.create(
                            card=card,
                            question_number=q_num,
                            text=q_text
                        )

                        if str(q_num) in answers_data:
                            answer_texts = answers_data[str(q_num)]
                            if isinstance(answer_texts, list):
                                lis = []
                                for point in answer_texts:
                                    escaped_point = str(point).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                                    lis.append(f'<li>{escaped_point}</li>')
                                answer_html = '<ol class="pl-5 space-y-1">' + ''.join(lis) + '</ol>'
                            else:
                                answer_html = text_to_html(answer_texts, wrap_paragraphs=False)

                            OSCEAnswer.objects.create(
                                question=question,
                                text=answer_html
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
    #  Old format processor (backward compatibility) – MODIFIED
    # ------------------------------------------------------------------
    def _process_old_format(self, json_dict, overwrite, user, filename):
        # Use filename as title (without extension)
        final_title = filename.rsplit('.', 1)[0] if filename else 'Untitled Set'

        if overwrite:
            osce_set, created = OSCESet.objects.get_or_create(
                title=final_title,
                defaults={'user': user, 'course_mode': 'commed'}
            )
            if not created:
                # Set existed – delete cards, update metadata
                osce_set.cards.all().delete()
                osce_set.user = user
                osce_set.course_mode = 'commed'
                osce_set.save()
        else:
            osce_set = OSCESet.objects.create(
                title=final_title,
                user=user,
                course_mode='commed'
            )

        cards_created = 0
        for card_key, card_data in json_dict.items():
            if not card_key.isdigit():
                continue

            explanation_html = text_to_html(card_data.get('explanation', ''))

            card = OSCECard.objects.create(
                osce_set=osce_set,
                title=card_data.get('image_name', f'Card {card_key}'),
                image=card_data.get('image_url') or card_data.get('image', ''),
                explanation=explanation_html
            )

            questions = card_data.get('questions', [])
            answers_data = card_data.get('answers', {})

            for question_item in questions:
                for q_num_str, q_text in question_item.items():
                    try:
                        q_num = int(q_num_str)
                    except ValueError:
                        q_num = len(card.questions.all()) + 1

                    question = OSCEQuestion.objects.create(
                        card=card,
                        question_number=q_num,
                        text=q_text
                    )

                    if str(q_num) in answers_data:
                        answer_texts = answers_data[str(q_num)]
                        if isinstance(answer_texts, list):
                            lis = []
                            for point in answer_texts:
                                escaped_point = str(point).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                                lis.append(f'<li>{escaped_point}</li>')
                            answer_html = '<ol class="pl-5 space-y-1">' + ''.join(lis) + '</ol>'
                        else:
                            answer_html = text_to_html(answer_texts, wrap_paragraphs=False)

                        OSCEAnswer.objects.create(
                            question=question,
                            text=answer_html
                        )

            cards_created += 1

        return {
            'success': True,
            'filename': filename,
            'title': final_title,
            'course_mode': 'commed',
            'cards_created': cards_created,
        }