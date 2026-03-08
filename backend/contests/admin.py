import logging
import traceback
from django import forms
from django.contrib import admin
from django.contrib import messages
from django.urls import reverse
from django.utils.html import format_html
from django.utils import timezone
from django.core.exceptions import ValidationError
from .models import Contest, ContestParticipation

logger = logging.getLogger(__name__)


class ContestAdminForm(forms.ModelForm):
    class Meta:
        model = Contest
        fields = '__all__'

    def clean(self):
        cleaned_data = super().clean()
        mcq_set = cleaned_data.get('mcq_set')
        total_questions = cleaned_data.get('total_questions')
        if mcq_set and total_questions:
            if total_questions > mcq_set.mcqs.count():
                raise forms.ValidationError({
                    'total_questions': (
                        f"Total questions ({total_questions}) cannot exceed the number of questions "
                        f"in the selected MCQ set ({mcq_set.mcqs.count()})."
                    )
                })
        return cleaned_data


class ContestParticipationInline(admin.TabularInline):
    model = ContestParticipation
    extra = 0
    readonly_fields = (
        'user', 'started_at', 'completed_at', 'score',
        'total_score', 'status', 'view_answers_link'
    )
    fields = (
        'user', 'status', 'score', 'total_score',
        'started_at', 'completed_at', 'view_answers_link'
    )
    can_delete = False
    max_num = 20
    show_change_link = True

    def view_answers_link(self, obj):
        if obj.pk:
            url = reverse('admin:contests_contestparticipation_change', args=[obj.pk])
            return format_html('<a href="{}">Review Answers</a>', url)
        return "-"
    view_answers_link.short_description = "Answers"

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Contest)
class ContestAdmin(admin.ModelAdmin):
    form = ContestAdminForm
    list_display = (
        'title', 'mcq_set', 'total_questions', 'start_time',
        'safe_end_time', 'status', 'participants_count', 'is_active_now'
    )
    list_filter = ('status', 'start_time', 'created_at')
    search_fields = ('title', 'mcq_set__title')
    date_hierarchy = 'start_time'
    readonly_fields = ('end_time', 'created_at', 'updated_at', 'participants_count', 'is_active_now')
    autocomplete_fields = ['mcq_set', 'created_by']
    inlines = [ContestParticipationInline]
    actions = ['make_active', 'make_ended', 'make_draft', 'regenerate_questions']

    fieldsets = (
        (None, {
            'fields': ('title', 'description', 'mcq_set', 'total_questions')
        }),
        ('Schedule & Status', {
            'fields': (
                'start_time', 'duration_minutes', 'end_time',
                'status', 'is_active_now'
            )
        }),
        ('Prizes', {
            'fields': ('prize_description',)
        }),
        ('Audit', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def safe_end_time(self, obj):
        return obj.end_time if obj.end_time else "Not set"
    safe_end_time.short_description = "End Time"
    safe_end_time.admin_order_field = 'end_time'

    def participants_count(self, obj):
        count = obj.participations.filter(status='completed').count()
        url = reverse('admin:contests_contestparticipation_changelist') + f'?contest__id__exact={obj.id}'
        return format_html('<a href="{}">{}</a>', url, count)
    participants_count.short_description = "Completed participants"

    def is_active_now(self, obj):
        if not obj.pk:
            return False
        if obj.start_time is None or obj.end_time is None:
            return False
        now = timezone.now()
        return (obj.start_time <= now <= obj.end_time and
                obj.status in ['scheduled', 'active'])
    is_active_now.boolean = True
    is_active_now.short_description = "Active now"

    def make_active(self, request, queryset):
        queryset.update(status='active')
    make_active.short_description = "Mark selected contests as active"

    def make_ended(self, request, queryset):
        queryset.update(status='ended')
    make_ended.short_description = "Mark selected contests as ended"

    def make_draft(self, request, queryset):
        queryset.update(status='draft')
    make_draft.short_description = "Revert selected contests to draft"

    def save_model(self, request, obj, form, change):
        """
        Override save_model to catch any exceptions and display them in the admin.
        """
        if not obj.pk:
            obj.created_by = request.user

        try:
            # Run full validation before saving
            obj.full_clean()
            super().save_model(request, obj, form, change)
        except ValidationError as e:
            # Convert ValidationError to user-friendly messages
            for field, errors in e.message_dict.items():
                for error in errors:
                    messages.error(request, f"{field}: {error}")
            logger.error(f"Validation error saving contest: {e}")
        except Exception as e:
            # Catch any other exception, log it, and show a message
            logger.error(f"Unexpected error saving contest: {e}\n{traceback.format_exc()}")
            messages.error(request, f"An unexpected error occurred: {e}")

    def regenerate_questions(self, request, queryset):
        for contest in queryset:
            try:
                contest.selected_question_ids = contest.get_random_question_ids()
                contest.questions_snapshot = contest._build_questions_snapshot()
                contest.save(update_fields=['selected_question_ids', 'questions_snapshot'])
            except Exception as e:
                messages.error(request, f"Failed to regenerate questions for {contest}: {e}")
        self.message_user(request, "Questions regenerated for selected contests.")
    regenerate_questions.short_description = "Regenerate question set"


@admin.register(ContestParticipation)
class ContestParticipationAdmin(admin.ModelAdmin):
    list_display = (
        'user', 'contest', 'started_at', 'completed_at',
        'score', 'total_score', 'status', 'answers_link'
    )
    list_filter = ('status', 'contest', 'started_at')
    search_fields = ('user__username', 'user__email', 'contest__title')
    readonly_fields = (
        'user', 'contest', 'started_at', 'completed_at',
        'score', 'total_score', 'selected_question_ids', 'answers'
    )
    fieldsets = (
        (None, {
            'fields': ('user', 'contest', 'status')
        }),
        ('Timeline', {
            'fields': ('started_at', 'completed_at')
        }),
        ('Score', {
            'fields': ('score', 'total_score')
        }),
        ('Snapshots', {
            'fields': ('selected_question_ids', 'answers'),
            'classes': ('collapse',)
        }),
    )

    def answers_link(self, obj):
        if obj.pk and obj.status == 'completed':
            url = reverse('admin:contests_contestparticipation_change', args=[obj.pk])
            return format_html('<a href="{}">View answers</a>', url)
        return "-"
    answers_link.short_description = "Answers"

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return True