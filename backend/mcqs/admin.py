import json
import logging
from django.contrib import admin, messages
from django import forms
from django.shortcuts import render, redirect
from django.http import HttpResponse, HttpResponseRedirect
from django.db import transaction
from django.urls import path, reverse
from django.utils import timezone
from django.utils.html import format_html
from django.template.loader import get_template
from django.template.exceptions import TemplateDoesNotExist
from .models import MCQSet, MCQ, Option, UserScore, ReportedQuestion

logger = logging.getLogger(__name__)

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

    def save_model(self, request, obj, form, change):
        if change and obj.pk:
            self._captured_siblings = list(obj.get_siblings())
        else:
            self._captured_siblings = []
        super().save_model(request, obj, form, change)

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        obj = form.instance

        obj.update_fingerprint()
        obj.save(update_fields=['fingerprint'])

        if change and hasattr(self, '_captured_siblings') and self._captured_siblings:
            options_data = []
            for opt in obj.options.order_by('key'):
                options_data.append({
                    'key': opt.key,
                    'text': opt.text,
                    'is_correct': opt.is_correct,
                })

            for sibling in self._captured_siblings:
                sibling.question = obj.question
                sibling.mcq_type = obj.mcq_type
                sibling.explanation = obj.explanation
                sibling.topic = obj.topic
                sibling.options.all().delete()
                Option.objects.bulk_create([
                    Option(
                        mcq=sibling,
                        key=d['key'],
                        text=d['text'],
                        is_correct=d['is_correct']
                    )
                    for d in options_data
                ])
                sibling.update_fingerprint()
                sibling.save(update_fields=[
                    'question', 'mcq_type', 'explanation', 'topic', 'fingerprint'
                ])

            messages.info(
                request,
                f"Updated {len(self._captured_siblings)} sibling question(s) with the new content."
            )

    def change_view(self, request, object_id, form_url='', extra_context=None):
        if request.GET.get('from_report'):
            messages.info(request, "You are editing a reported question. Changes will propagate to all siblings.")
            mcq = self.get_object(request, object_id)
            if mcq:
                siblings = mcq.get_siblings()
                if siblings.exists():
                    messages.info(request, f"There are {siblings.count()} sibling question(s) with the same content. They will be updated automatically.")
                else:
                    messages.info(request, "No sibling questions found.")
        return super().change_view(request, object_id, form_url, extra_context)


# ===========================
# ReportedQuestion Admin
# ===========================
@admin.register(ReportedQuestion)
class ReportedQuestionAdmin(admin.ModelAdmin):
    list_display = (
        'mcq_short',
        'mcq_set_title',
        'course_mode',
        'status',
        'report_count',
        'sibling_count',
        'created_at'
    )
    list_filter = ('status', 'created_at')
    search_fields = ('mcq__question', 'mcq__mcq_set__title')
    actions = ['mark_reviewed', 'mark_resolved']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('mcq', 'mcq__mcq_set', 'user')

    def mcq_short(self, obj):
        return obj.mcq.question[:50] + '...' if len(obj.mcq.question) > 50 else obj.mcq.question
    mcq_short.short_description = 'Question'

    def mcq_set_title(self, obj):
        return obj.mcq.mcq_set.title
    mcq_set_title.short_description = 'Set'

    def course_mode(self, obj):
        return obj.mcq.mcq_set.course_mode
    course_mode.short_description = 'Course'

    def report_count(self, obj):
        return ReportedQuestion.objects.filter(mcq=obj.mcq).count()
    report_count.short_description = 'Reports'

    def sibling_count(self, obj):
        course_mode = obj.mcq.mcq_set.course_mode
        count = obj.mcq.get_siblings(course_mode=course_mode).count()
        if count:
            url = reverse('admin:mcqs_mcq_changelist') + f'?fingerprint={obj.mcq.fingerprint}'
            return format_html('<a href="{}">{}</a>', url, count)
        return '0'
    sibling_count.short_description = 'Siblings (same course)'

    def mark_reviewed(self, request, queryset):
        queryset.update(status='reviewed')
    mark_reviewed.short_description = "Mark selected as Reviewed"

    def mark_resolved(self, request, queryset):
        now = timezone.now()
        updated = queryset.update(status='resolved', resolved_at=now, resolved_by=request.user)
        self.message_user(request, f"{updated} report(s) marked as resolved.")
    mark_resolved.short_description = "Mark selected as Resolved"

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                '<int:report_id>/mark-reviewed/',
                self.admin_site.admin_view(self.mark_reviewed_view),
                name='mcqs_reportedquestion_mark_reviewed'
            ),
        ]
        return custom_urls + urls

    def mark_reviewed_view(self, request, report_id):
        report = self.get_object(request, report_id)
        if report:
            report.status = 'reviewed'
            report.save(update_fields=['status'])
            messages.success(request, f"Report #{report.id} marked as reviewed.")
        return redirect('admin:mcqs_reportedquestion_changelist')

    # ----- Custom JSON edit view -----
    def change_view(self, request, object_id, form_url='', extra_context=None):
        try:
            report = self.get_object(request, object_id)
            if not report:
                return super().change_view(request, object_id, form_url, extra_context)

            if request.method == 'POST':
                json_data = request.POST.get('json_data', '')
                try:
                    data = json.loads(json_data)
                    if len(data) == 1:
                        key = next(iter(data))
                        if key.isdigit():
                            data = data[key]

                    if 'QUESTION' not in data or 'OPTION' not in data:
                        raise ValueError("Missing required keys: QUESTION and OPTION")
                    has_true_false = 'TRUE' in data and 'FALSE' in data
                    has_correct = 'CORRECT' in data
                    if not has_true_false and not has_correct:
                        raise ValueError("Missing either 'TRUE'/'FALSE' arrays or 'CORRECT' key")

                    self._update_mcq_from_json(report.mcq, data, request, report=report)
                    messages.success(request, "Question updated successfully. Changes propagated to all siblings.")
                    return redirect(request.path)

                except json.JSONDecodeError as e:
                    messages.error(request, f"Invalid JSON: {e}")
                except ValueError as e:
                    messages.error(request, f"Validation error: {e}")
                except Exception as e:
                    messages.error(request, f"Error updating question: {e}")

            # GET – build snapshot with correct format
            snapshot = self._build_snapshot_from_mcq(report.mcq)
            json_str = json.dumps(snapshot, indent=2)

            course_mode = report.mcq.mcq_set.course_mode if report.mcq and report.mcq.mcq_set else 'unknown'
            siblings = report.mcq.get_siblings(course_mode=course_mode) if report.mcq else []

            context = {
                'report': report,
                'snapshot_json': json_str,
                'siblings': siblings,
                'opts': self.model._meta,
                'original': report,
                'is_popup': request.GET.get('_popup', False),
                'media': self.media,
                'has_change_permission': self.has_change_permission(request, report),
                'has_delete_permission': self.has_delete_permission(request, report),
            }

            try:
                get_template('admin/mcqs/reportedquestion/change_form.html')
                return render(request, 'admin/mcqs/reportedquestion/change_form.html', context)
            except TemplateDoesNotExist:
                logger.warning("Custom template not found; using default admin change view.")
                return super().change_view(request, object_id, form_url, extra_context)

        except Exception as e:
            logger.error(f"Error in ReportedQuestionAdmin.change_view: {e}", exc_info=True)
            return super().change_view(request, object_id, form_url, extra_context)

    # ===== Helper methods =====
    def _build_snapshot_from_mcq(self, mcq):
        """Build snapshot in the correct format based on mcq_type."""
        if not mcq:
            return {}

        base = {
            "QUESTION": mcq.question or "",
            "OPTION": {
                opt.key: opt.text
                for opt in mcq.options.order_by('key')
            },
            "TOPIC_CATEGORY": mcq.topic or "",
            "EXPLANATION": mcq.explanation or "",
        }

        if mcq.mcq_type == 'MCQ':
            correct_opt = mcq.options.filter(is_correct=True).first()
            base["CORRECT"] = correct_opt.key if correct_opt else ''
            return {str(mcq.id): base}
        else:  # TF
            base["TRUE"] = [opt.key for opt in mcq.options.filter(is_correct=True).order_by('key')]
            base["FALSE"] = [opt.key for opt in mcq.options.filter(is_correct=False).order_by('key')]
            return {str(mcq.id): base}

    def _update_mcq_from_json(self, mcq, data, request, report=None):
        with transaction.atomic():
            siblings = list(mcq.get_siblings())

            mcq.question = data.get('QUESTION', mcq.question)
            mcq.topic = data.get('TOPIC_CATEGORY', mcq.topic)
            mcq.explanation = data.get('EXPLANATION', mcq.explanation)

            options_data = data.get('OPTION', {})
            has_true_false = 'TRUE' in data and 'FALSE' in data
            has_correct = 'CORRECT' in data

            if has_true_false:
                mcq.mcq_type = 'TF'
                true_keys = data.get('TRUE', [])
            elif has_correct:
                mcq.mcq_type = 'MCQ'
                correct_key = data.get('CORRECT', '')
                true_keys = [correct_key] if correct_key else []
            else:
                raise ValueError("Unsupported format")

            mcq.options.all().delete()
            for key, text in options_data.items():
                is_correct = key in true_keys
                Option.objects.create(
                    mcq=mcq,
                    key=key,
                    text=text,
                    is_correct=is_correct
                )

            mcq.update_fingerprint()
            mcq.save(update_fields=['question', 'topic', 'explanation', 'mcq_type', 'fingerprint'])

            if siblings:
                options_data = []
                for opt in mcq.options.order_by('key'):
                    options_data.append({
                        'key': opt.key,
                        'text': opt.text,
                        'is_correct': opt.is_correct,
                    })

                for sibling in siblings:
                    sibling.question = mcq.question
                    sibling.mcq_type = mcq.mcq_type
                    sibling.explanation = mcq.explanation
                    sibling.topic = mcq.topic
                    sibling.options.all().delete()
                    Option.objects.bulk_create([
                        Option(
                            mcq=sibling,
                            key=d['key'],
                            text=d['text'],
                            is_correct=d['is_correct']
                        )
                        for d in options_data
                    ])
                    sibling.update_fingerprint()
                    sibling.save(update_fields=[
                        'question', 'mcq_type', 'explanation', 'topic', 'fingerprint'
                    ])

                messages.info(request, f"Updated {len(siblings)} sibling question(s).")

            # Update snapshot for this specific report
            if report:
                new_snapshot = self._build_snapshot_from_mcq(mcq)
                report.snapshot = new_snapshot
                report.save(update_fields=['snapshot'])
            else:
                report_qs = ReportedQuestion.objects.filter(mcq=mcq)
                if report_qs.exists():
                    first_report = report_qs.first()
                    first_report.snapshot = self._build_snapshot_from_mcq(mcq)
                    first_report.save(update_fields=['snapshot'])


# ===========================
# MCQSet Admin (with JSON upload and download)
# ===========================
@admin.register(MCQSet)
class MCQSetAdmin(admin.ModelAdmin):
    list_display = ['title', 'created_at', 'mcq_count', 'download_button']
    search_fields = ['title']
    list_filter = ['created_at']
    change_list_template = "admin/mcqs/mcqset/change_list.html"

    def mcq_count(self, obj):
        return obj.mcqs.count()
    mcq_count.short_description = "Number of Questions"

    def download_button(self, obj):
        url = reverse('admin:mcqset_download_json', args=[obj.id])
        return format_html(
            '<a href="{}" class="button" style="background: #28a745; color: white; padding: 4px 10px; border-radius: 4px; text-decoration: none; font-size: 12px; white-space: nowrap;">⬇ Download Set</a>',
            url
        )
    download_button.short_description = "Download"
    download_button.allow_tags = True

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                'upload-json/',
                self.admin_site.admin_view(self.upload_json),
                name='mcqs_mcqset_upload_json',
            ),
            path(
                'download-json/<int:set_id>/',
                self.admin_site.admin_view(self.download_set_json),
                name='mcqset_download_json',
            ),
        ]
        return custom_urls + urls

    def download_set_json(self, request, set_id):
        """Download all MCQs in a set as a single JSON file in upload format."""
        try:
            mcq_set = MCQSet.objects.get(id=set_id)
        except MCQSet.DoesNotExist:
            return HttpResponse("MCQ Set not found.", status=404)

        # Build META_DATA
        first_mcq = mcq_set.mcqs.first()
        if first_mcq:
            set_type = "TRUE FALSE" if first_mcq.mcq_type == 'TF' else "MCQ"
        else:
            set_type = "MCQ"

        meta_data = {
            "META_DATA": {
                "COURSE": mcq_set.course_mode.upper(),
                "TITLE": mcq_set.title,
                "TYPE": set_type
            }
        }
        
        # Build questions with sequential numbering
        questions = []
        question_number = 1
        for mcq in mcq_set.mcqs.all().order_by('id'):
            base = {
                "QUESTION": mcq.question or "",
                "OPTION": {
                    opt.key: opt.text
                    for opt in mcq.options.order_by('key')
                },
                "TOPIC_CATEGORY": mcq.topic or "",
                "EXPLANATION": mcq.explanation or "",
            }

            if mcq.mcq_type == 'MCQ':
                correct_opt = mcq.options.filter(is_correct=True).first()
                base["CORRECT"] = correct_opt.key if correct_opt else ''
            else:  # TF
                true_keys = [opt.key for opt in mcq.options.filter(is_correct=True).order_by('key')]
                false_keys = [opt.key for opt in mcq.options.filter(is_correct=False).order_by('key')]
                base["TRUE"] = true_keys
                base["FALSE"] = false_keys

            questions.append({str(question_number): base})
            question_number += 1

        # Combine: meta data first, then questions
        output_data = [meta_data] + questions

        # Return as JSON download with compact arrays
        response = HttpResponse(
            json.dumps(output_data, indent=2, separators=(',', ': ')),
            content_type='application/json'
        )
        filename = f"{mcq_set.title.replace(' ', '_')}.json"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context['upload_json_url'] = reverse('admin:mcqs_mcqset_upload_json')
        return super().changelist_view(request, extra_context=extra_context)

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

    def process_json_data(self, json_data, overwrite, user, filename=None):
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
            mcq_set, created = MCQSet.objects.get_or_create(
                title=final_title,
                defaults={'user': user, 'course_mode': course_mode}
            )
            if not created:
                mcq_set.mcqs.all().delete()
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

                mcq.update_fingerprint()
                mcq.save(update_fields=['fingerprint'])
                questions_created += 1

        return {
            'success': True,
            'filename': filename,
            'title': final_title,
            'course_mode': course_mode,
            'mcq_type': file_mcq_type,
            'questions_created': questions_created,
        }

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

            mcq.update_fingerprint()
            mcq.save(update_fields=['fingerprint'])
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