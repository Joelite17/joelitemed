from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.contenttypes.models import ContentType
from django.utils.html import format_html
from django.urls import reverse
from .models import *


class UserSetAttemptInline(admin.TabularInline):
    """Inline for displaying user attempts in User admin"""
    model = UserSetAttempt
    extra = 0
    max_num = 10  # Show only last 10 attempts
    can_delete = False
    readonly_fields = ['content_type', 'object_id', 'attempt_count', 'last_attempted', 'created_at']
    fields = ['content_type', 'object_id', 'attempt_count', 'last_attempted']
    
    def has_add_permission(self, request, obj=None):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False


class UserSetAttemptAdmin(admin.ModelAdmin):
    """Admin for UserSetAttempt model"""
    list_display = [
        'user', 
        'content_type_display', 
        'content_object_link', 
        'attempt_count', 
        'last_attempted', 
        'created_at'
    ]
    list_filter = [
        'content_type', 
        'last_attempted', 
        'created_at'
    ]
    search_fields = [
        'user__username', 
        'user__email', 
        'content_type__model'
    ]
    readonly_fields = [
        'user', 
        'content_type', 
        'object_id', 
        'content_object_link', 
        'attempt_count', 
        'last_attempted', 
        'created_at'
    ]
    date_hierarchy = 'last_attempted'
    list_per_page = 20
    
    def content_type_display(self, obj):
        """Display the content type in a friendly format"""
        if obj.content_type:
            model_name = obj.content_type.model_class().__name__ if obj.content_type.model_class() else obj.content_type.model
            return f"{model_name}"
        return "N/A"
    content_type_display.short_description = "Resource Type"
    
    def content_object_link(self, obj):
        """Create a clickable link to the content object"""
        if obj.content_object:
            try:
                # Try to get admin URL for the content object
                admin_url = reverse(
                    f'admin:{obj.content_type.app_label}_{obj.content_type.model}_change',
                    args=[obj.object_id]
                )
                return format_html(
                    '<a href="{}">{}</a>',
                    admin_url,
                    str(obj.content_object)[:50]
                )
            except:
                # If admin URL fails, just return the string
                return str(obj.content_object)[:50]
        return "N/A"
    content_object_link.short_description = "Content Object"
    content_object_link.allow_tags = True
    
    def get_queryset(self, request):
        """Optimize queryset with select_related"""
        queryset = super().get_queryset(request)
        return queryset.select_related('user', 'content_type')
    
    def has_add_permission(self, request):
        """Disable adding attempts from admin"""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Allow deleting attempts"""
        return True


class UserAdmin(BaseUserAdmin):
    """Custom User Admin with attempts"""
    # Add custom fields to the admin form
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Custom Fields", {"fields": ("email_confirmed", "dark_mode")}),
        ("Statistics", {"fields": ("total_attempts_display", "last_activity")}),
    )
    
    # Add custom fields to the user list display
    list_display = BaseUserAdmin.list_display + (
        "email_confirmed", 
        "dark_mode", 
        "total_attempts", 
        "last_activity"
    )
    list_filter = BaseUserAdmin.list_filter + (
        "email_confirmed", 
        "dark_mode", 
        "date_joined"
    )
    
    # Optional: Add search fields
    search_fields = BaseUserAdmin.search_fields + ("email",)
    
    # Inlines for attempts
    inlines = [UserSetAttemptInline]
    
    # Readonly fields for statistics
    readonly_fields = ['total_attempts_display', 'last_activity']
    
    def total_attempts_display(self, obj):
        """Display total attempts for this user"""
        total = UserSetAttempt.objects.filter(user=obj).count()
        return format_html(
            '<strong>{}</strong> <a href="{}?user__id__exact={}" style="margin-left:10px;font-size:12px;">(View All)</a>',
            total,
            reverse('admin:accounts_usersetattempt_changelist'),
            obj.id
        )
    total_attempts_display.short_description = "Total Attempts"
    total_attempts_display.allow_tags = True
    
    def total_attempts(self, obj):
        """Total attempts for list display"""
        return UserSetAttempt.objects.filter(user=obj).count()
    total_attempts.short_description = "Attempts"
    
    def last_activity(self, obj):
        """Get user's last activity (from last attempt)"""
        last_attempt = UserSetAttempt.objects.filter(user=obj).order_by('-last_attempted').first()
        if last_attempt and last_attempt.last_attempted:
            return last_attempt.last_attempted
        return "No activity"
    last_activity.short_description = "Last Activity"
    
    def get_queryset(self, request):
        """Optimize queryset for list view"""
        queryset = super().get_queryset(request)
        return queryset.prefetch_related('set_attempts')
    
    # Optional: Add actions
    actions = ['reset_attempt_counts']
    
    def reset_attempt_counts(self, request, queryset):
        """Admin action to reset attempt counts for selected users"""
        for user in queryset:
            UserSetAttempt.objects.filter(user=user).delete()
        self.message_user(request, f"Attempt counts reset for {queryset.count()} user(s).")
    reset_attempt_counts.short_description = "Reset attempt counts"


# Register the custom user model
admin.site.register(User, UserAdmin)

# Register the UserSetAttempt model
admin.site.register(UserSetAttempt, UserSetAttemptAdmin)


@admin.register(FreeTrialUsage)
class FreeTrialUsageAdmin(admin.ModelAdmin):
    list_display = ['user', 'date', 'first_access']
    list_filter = ['date']
    search_fields = ['user__username']