from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path("accounts/", include("accounts.urls", namespace="accounts")),
    path("notes/", include("notes.urls")),
    path('flashcardsets/', include('flashcards.urls')), 
    path('mcqsets/', include('mcqs.urls')),
    path('mcqs/scores/', include('mcqs.scores_urls')),  # Scores endpoint
    path("oscesets/", include("osces.urls")),
    path('feed/', include('feed.urls')),  # NEW - Add this line
    path('subscriptions/', include('subscriptions.urls')),
    path('contests/', include('contests.urls')),
    
    
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

