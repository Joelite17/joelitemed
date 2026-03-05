from rest_framework import serializers
from .models import FeedItem
from flashcards.serializers import FlashcardSetSerializer
from mcqs.serializers import MCQSetSerializer
from osces.serializers import OSCESetSerializer
from notes.serializers import NoteSerializer

class FeedItemSerializer(serializers.ModelSerializer):
    content_data = serializers.SerializerMethodField()
    content_type_display = serializers.CharField(source='get_content_type_display', read_only=True)
    user_info = serializers.SerializerMethodField()
    user_liked = serializers.SerializerMethodField()
    course_mode = serializers.CharField(read_only=True)

    class Meta:
        model = FeedItem
        fields = [
            'id', 'content_type', 'content_type_display', 'content_id',
            'content_data', 'user', 'user_info', 'created_at', 
            'likes_count', 'score', 'user_liked', 'course_mode'
        ]
        read_only_fields = ['created_at', 'likes_count', 'score', 'course_mode']

    def get_user_info(self, obj):
        if obj.user:
            return {
                'id': obj.user.id,
                'username': obj.user.username,
                'email': obj.user.email
            }
        return None

    def get_user_liked(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        content_object = self._get_content_object(obj)
        if content_object and hasattr(content_object, 'likes'):
            return content_object.likes.filter(id=request.user.id).exists()
        return False

    def get_content_data(self, obj):
        request = self.context.get('request')
        content_object = self._get_content_object(obj)
        if not content_object:
            return None
        if obj.content_type == 'flashcard_set':
            return FlashcardSetSerializer(content_object, context={'request': request}).data
        elif obj.content_type == 'mcq_set':
            return MCQSetSerializer(content_object, context={'request': request}).data
        elif obj.content_type == 'osce_set':
            return OSCESetSerializer(content_object, context={'request': request}).data
        elif obj.content_type == 'note':
            if content_object.visibility == 'public':
                return NoteSerializer(content_object, context={'request': request}).data
        return None

    def _get_content_object(self, obj):
        if hasattr(obj, '_content_object'):
            return obj._content_object
        if obj.content_type == 'flashcard_set':
            from flashcards.models import FlashcardSet
            obj._content_object = FlashcardSet.objects.filter(id=obj.content_id).first()
        elif obj.content_type == 'mcq_set':
            from mcqs.models import MCQSet
            obj._content_object = MCQSet.objects.filter(id=obj.content_id).first()
        elif obj.content_type == 'osce_set':
            from osces.models import OSCESet
            obj._content_object = OSCESet.objects.filter(id=obj.content_id).first()
        elif obj.content_type == 'note':
            from notes.models import Note
            obj._content_object = Note.objects.filter(id=obj.content_id).first()
        else:
            obj._content_object = None
        return obj._content_object