import json
from django.contrib import admin
from django import forms
from django.shortcuts import render
from django.contrib import messages
from django.http import HttpResponseRedirect
from django.db import transaction
from django.urls import path, reverse
from .models import MCQSet, MCQ, Option, UserScore

# ----------------------------------------------------------------------
#  JSON Upload Form
# ----------------------------------------------------------------------
class MCQUploadForm(forms.Form):
    overwrite = forms.BooleanField(
        required=False,
        initial=False,
        label='Overwrite existing sets with same title',
        help_text='If checked, any existing set with the same title will have its questions replaced (the set ID stays the same).'
    )

# ===========================
# Inline for Options
# ===========================
class OptionInline(admin.StackedInline):
    model = Option
    extra = 2
    min_num = 1
    fields = ['key', 'text', 'is_correct']
    verbose_name = "Option"
    verbose_name_plural = "Options"
    show_change_link = True

# ===========================
# MCQ Admin
# ===========================
@admin.register(MCQ)
class MCQAdmin(admin.ModelAdmin):
    list_display = ['question_short', 'mcq_set', 'mcq_type', 'topic', 'correct_options']
    list_filter = ['mcq_set', 'mcq_type', 'topic']
    search_fields = ['question', 'topic']
    inlines = [OptionInline]
    fields = ['mcq_set', 'question', 'mcq_type', 'explanation', 'topic']

    def question_short(self, obj):
        return obj.question[:50] + ("..." if len(obj.question) > 50 else "")
    question_short.short_description = "Question"

    def correct_options(self, obj):
        correct = obj.options.filter(is_correct=True)
        return ", ".join([f"{opt.key}" for opt in correct])
    correct_options.short_description = "Correct Answer(s)"

# ===========================
# MCQSet Admin (with JSON upload)
# ===========================
@admin.register(MCQSet)
class MCQSetAdmin(admin.ModelAdmin):
    list_display = ['title', 'created_at', 'mcq_count']
    search_fields = ['title']
    list_filter = ['created_at']
    change_list_template = "admin/mcqs/mcqset/change_list.html"

    def mcq_count(self, obj):
        return obj.mcqs.count()
    mcq_count.short_description = "Number of Questions"

    # ------------------------------------------------------------------
    #  Custom URLs
    # ------------------------------------------------------------------
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                'upload-json/',
                self.admin_site.admin_view(self.upload_json),
                name='mcqs_mcqset_upload_json',
            ),
        ]
        return custom_urls + urls

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context['upload_json_url'] = reverse('admin:mcqs_mcqset_upload_json')
        return super().changelist_view(request, extra_context=extra_context)

    # ------------------------------------------------------------------
    #  JSON Upload Handler (Multiple Files)
    # ------------------------------------------------------------------
    def upload_json(self, request):
        if request.method == 'POST':
            form = MCQUploadForm(request.POST)
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
                                    f"Type: {s.get('mcq_type', '?')}, "
                                    f"Questions: {s.get('questions_created', 0)}")
                            msg_lines.append(line)
                        messages.success(request, "\n".join(msg_lines))

                    if errors:
                        for err in errors:
                            messages.error(request, err['message'])

                    if not successes and not errors:
                        messages.warning(request, "No files processed.")

                    return HttpResponseRedirect('..')
        else:
            form = MCQUploadForm()

        context = {
            'form': form,
            'title': 'Upload MCQ JSON',
            'opts': self.model._meta,
            'media': self.media,
            'has_permission': True,
        }
        return render(request, 'admin/mcq_upload_json.html', context)

    # ------------------------------------------------------------------
    #  Core processing logic (detects format)
    # ------------------------------------------------------------------
    def process_json_data(self, json_data, overwrite, user, filename=None):
        """
        Convert JSON to MCQ set(s). Handles both old format (dict of questions)
        and new format (list with metadata).
        Returns dict with success, message, title, etc.
        """
        try:
            with transaction.atomic():
                if isinstance(json_data, list) and len(json_data) >= 2 and 'META_DATA' in json_data[0]:
                    return self._process_new_format(json_data, overwrite, user, filename)
                elif isinstance(json_data, dict):
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

        final_title = meta.get('TITLE', '').strip()
        if not final_title:
            final_title = filename.rsplit('.', 1)[0] if filename else 'Untitled Set'

        course_map = {
            'MEDICINE': 'medicine',
            'SURGERY': 'surgery',
            'COMMUNITY MEDICINE': 'commed',
        }
        course_mode = course_map.get(meta.get('COURSE', '').upper(), 'commed')

        type_raw = meta.get('TYPE', '').upper()
        file_mcq_type = 'TF' if ('TRUE FALSE' in type_raw or 'TF' in type_raw) else 'MCQ'

        if overwrite:
            # Find or create set with same title
            mcq_set, created = MCQSet.objects.get_or_create(
                title=final_title,
                defaults={'user': user, 'course_mode': course_mode}
            )
            if not created:
                # Set existed – delete its MCQs (cascades to options)
                mcq_set.mcqs.all().delete()
                # Update metadata
                mcq_set.user = user
                mcq_set.course_mode = course_mode
                mcq_set.save()
        else:
            mcq_set = MCQSet.objects.create(
                title=final_title,
                user=user,
                course_mode=course_mode
            )

        questions_created = 0
        for elem in json_list[1:]:
            if not isinstance(elem, dict):
                continue
            for q_key, q_data in elem.items():
                if not q_key.isdigit():
                    continue

                question_text = q_data.get('QUESTION', '')
                options_dict = q_data.get('OPTION', {})
                topic = q_data.get('TOPIC_CATEGORY', '')
                explanation = q_data.get('EXPLANATION', '')

                mcq = MCQ.objects.create(
                    mcq_set=mcq_set,
                    question=question_text,
                    mcq_type=file_mcq_type,
                    explanation=explanation,
                    topic=topic
                )

                if file_mcq_type == 'TF':
                    true_keys = q_data.get('TRUE', [])
                    for opt_key, opt_text in options_dict.items():
                        is_correct = opt_key in true_keys
                        Option.objects.create(
                            mcq=mcq,
                            key=opt_key,
                            text=opt_text,
                            is_correct=is_correct
                        )
                else:
                    correct_key = q_data.get('CORRECT', '')
                    for opt_key, opt_text in options_dict.items():
                        is_correct = (opt_key == correct_key)
                        Option.objects.create(
                            mcq=mcq,
                            key=opt_key,
                            text=opt_text,
                            is_correct=is_correct
                        )

                questions_created += 1

        return {
            'success': True,
            'filename': filename,
            'title': final_title,
            'course_mode': course_mode,
            'mcq_type': file_mcq_type,
            'questions_created': questions_created,
        }

    # ------------------------------------------------------------------
    #  Old format processor (backward compatibility) – MODIFIED
    # ------------------------------------------------------------------
    def _process_old_format(self, json_dict, overwrite, user, filename):
        title = filename.rsplit('.', 1)[0] if filename else 'Untitled Set'

        if overwrite:
            mcq_set, created = MCQSet.objects.get_or_create(
                title=title,
                defaults={'user': user, 'course_mode': 'commed'}
            )
            if not created:
                mcq_set.mcqs.all().delete()
                mcq_set.user = user
                mcq_set.course_mode = 'commed'
                mcq_set.save()
        else:
            mcq_set = MCQSet.objects.create(
                title=title,
                user=user,
                course_mode='commed'
            )

        questions_created = 0
        for key, item in json_dict.items():
            question_text = item.get('QUESTION', '')
            options_dict = item.get('OPTION', {})
            true_keys = item.get('TRUE', [])
            topic = item.get('TOPIC_CATEGORY', '')
            explanation = item.get('EXPLANATION', '')

            mcq = MCQ.objects.create(
                mcq_set=mcq_set,
                question=question_text,
                mcq_type='TF',
                explanation=explanation,
                topic=topic
            )

            for opt_key, opt_text in options_dict.items():
                is_correct = opt_key in true_keys
                Option.objects.create(
                    mcq=mcq,
                    key=opt_key,
                    text=opt_text,
                    is_correct=is_correct
                )

            questions_created += 1

        return {
            'success': True,
            'filename': filename,
            'title': title,
            'course_mode': 'commed',
            'mcq_type': 'TF',
            'questions_created': questions_created,
        }

# ===========================
# Option Admin
# ===========================
@admin.register(Option)
class OptionAdmin(admin.ModelAdmin):
    list_display = ['mcq', 'key', 'text', 'is_correct']
    list_filter = ['is_correct']
    search_fields = ['text']

# ===========================
# UserScore Admin
# ===========================
@admin.register(UserScore)
class UserScoreAdmin(admin.ModelAdmin):
    list_display = ['user', 'mcq_set', 'score', 'taken_at']
    list_filter = ['mcq_set']