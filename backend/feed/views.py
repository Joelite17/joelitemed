from rest_framework import generics, permissions, filters
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import FeedItem
from .serializers import FeedItemSerializer
from .pagination import FeedPagination
from rest_framework.pagination import PageNumberPagination
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

class FeedListView(generics.ListAPIView):
    serializer_class = FeedItemSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    pagination_class = FeedPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['content_type']
    ordering_fields = ['created_at', 'likes_count', 'score']
    ordering = ['-created_at']
    
    def get_queryset(self):
        queryset = FeedItem.objects.all()
        user = self.request.user
        # Filter by authenticated user's course_mode
        if user.is_authenticated and user.course_mode:
            queryset = queryset.filter(course_mode=user.course_mode)
        content_type = self.request.query_params.get('content_type')
        if content_type:
            queryset = queryset.filter(content_type=content_type)
        
        return queryset.select_related('user')
    
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            filtered_data = [
                item for item in serializer.data 
                if item.get('content_data') is not None
            ]
            return self.get_paginated_response(filtered_data)
        
        serializer = self.get_serializer(queryset, many=True)
        filtered_data = [
            item for item in serializer.data 
            if item.get('content_data') is not None
        ]
        return Response(filtered_data)


class UserLikedPostsView(generics.ListAPIView):
    """Get all posts liked by the current user with pagination"""
    serializer_class = FeedItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = PageNumberPagination
    
    def get_queryset(self):
        user = self.request.user
        content_type = self.request.query_params.get('content_type', None)
        
        # Start with FeedItems, filter by user's course mode if set
        queryset = FeedItem.objects.all()
        if user.course_mode:
            queryset = queryset.filter(course_mode=user.course_mode)
        
        if content_type:
            queryset = queryset.filter(content_type=content_type)
        
        # Now filter to only items the user has liked
        liked_items = []
        for item in queryset:
            # Get the actual content object
            if item.content_type == 'flashcard_set':
                from flashcards.models import FlashcardSet
                obj = FlashcardSet.objects.filter(id=item.content_id).first()
            elif item.content_type == 'mcq_set':
                from mcqs.models import MCQSet
                obj = MCQSet.objects.filter(id=item.content_id).first()
            elif item.content_type == 'osce_set':
                from osces.models import OSCESet
                obj = OSCESet.objects.filter(id=item.content_id).first()
            elif item.content_type == 'note':
                from notes.models import Note
                obj = Note.objects.filter(id=item.content_id).first()
            else:
                obj = None
            
            # Check if user liked this item
            if obj and hasattr(obj, 'likes') and obj.likes.filter(id=user.id).exists():
                liked_items.append(item)
        
        return liked_items
    
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def toggle_like(request):
    """Unified like endpoint for all content types"""
    content_type_str = request.data.get('content_type')
    content_id = request.data.get('content_id')
    
    # Map string content type to actual model
    content_type_map = {
        'flashcard_set': ('flashcards', 'flashcardset'),
        'mcq_set': ('mcqs', 'mcqset'),
        'osce_set': ('osces', 'osceset'),
        'note': ('notes', 'note')
    }
    
    if content_type_str not in content_type_map:
        return Response({'error': 'Invalid content type'}, status=400)
    
    # Get the model
    if content_type_str == 'flashcard_set':
        from flashcards.models import FlashcardSet
        model = FlashcardSet
    elif content_type_str == 'mcq_set':
        from mcqs.models import MCQSet
        model = MCQSet
    elif content_type_str == 'osce_set':
        from osces.models import OSCESet
        model = OSCESet
    elif content_type_str == 'note':
        from notes.models import Note
        model = Note
    else:
        return Response({'error': 'Content type not supported'}, status=400)
    
    try:
        obj = model.objects.get(id=content_id)
    except model.DoesNotExist:
        return Response({'error': 'Content not found'}, status=404)
    
    user = request.user
    
    if hasattr(obj, 'likes'):
        if obj.likes.filter(id=user.id).exists():
            obj.likes.remove(user)
            liked = False
        else:
            obj.likes.add(user)
            liked = True
        likes_count = obj.likes.count()
    else:
        liked = False
        likes_count = 0
    
    return Response({
        'liked': liked,
        'likes_count': likes_count,
        'content_type': content_type_str,
        'content_id': content_id
    })