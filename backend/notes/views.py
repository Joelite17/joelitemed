from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import Note
from .serializers import NoteSerializer
from accounts.permissions import HasFreeAccessOrSubscription   # <-- new

class NoteViewSet(viewsets.ModelViewSet):
    queryset = Note.objects.all().order_by("-created_at")
    serializer_class = NoteSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_permissions(self):
        if self.action == 'retrieve':
            return [HasFreeAccessOrSubscription()]
        return super().get_permissions()

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_authenticated and user.course_mode:
            queryset = queryset.filter(course_mode=user.course_mode)
        # Also filter by visibility for unauthenticated
        if not user.is_authenticated:
            queryset = queryset.filter(visibility='public')
        elif not user.has_active_subscription:
            # If not subscribed, maybe filter out subscriber-only
            queryset = queryset.exclude(visibility='subscriber')
        return queryset

    def perform_create(self, serializer):
        serializer.save(author=self.request.user, user=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def toggle_like(self, request, pk=None):
        note = self.get_object()
        user = request.user
        if note.likes.filter(id=user.id).exists():
            note.likes.remove(user)
            liked = False
        else:
            note.likes.add(user)
            liked = True
        return Response({
            "liked": liked,
            "likes_count": note.likes.count()
        })