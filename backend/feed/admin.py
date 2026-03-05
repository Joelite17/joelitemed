from django.contrib import admin
from django.urls import path
from django.shortcuts import redirect
from django.contrib import messages
from django.core.management import call_command
from .models import FeedItem

@admin.register(FeedItem)
class FeedItemAdmin(admin.ModelAdmin):
    list_display = ['id', 'content_type', 'content_id', 'user', 'created_at', 'likes_count']
    list_filter = ['content_type', 'created_at']
    search_fields = ['content_id', 'user__username']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'created_at'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')

    # Add custom admin URL for sending digest
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('send-digest/', self.admin_site.admin_view(self.send_digest_view), name='feed_feeditem_send_digest'),
        ]
        return custom_urls + urls

    def send_digest_view(self, request):
        """
        Admin view that triggers the daily digest command immediately.
        """
        try:
            # Call the management command (uses the same logic as scheduled)
            call_command('send_daily_digest')
            self.message_user(request, "✅ Daily digest sent successfully.", level=messages.SUCCESS)
        except Exception as e:
            self.message_user(request, f"❌ Error sending digest: {e}", level=messages.ERROR)
        return redirect('..')  # redirect back to the changelist