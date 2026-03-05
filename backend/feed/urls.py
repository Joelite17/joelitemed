# backend/feed/urls.py
from django.urls import path
from .views import *
urlpatterns = [
    path('', FeedListView.as_view(), name='feed-list'),
    path('toggle-like/', toggle_like, name='toggle-like'),  # Add this
    path('user-liked/', UserLikedPostsView.as_view(), name='user-liked-posts'),  # Add this
]