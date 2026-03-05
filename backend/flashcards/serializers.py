from rest_framework import serializers
from .models import FlashcardSet, Flashcard

class FlashcardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Flashcard
        fields = ['id', 'question', 'answer', 'type']

class FlashcardSetSerializer(serializers.ModelSerializer):
    cards = FlashcardSerializer(many=True, read_only=True)
    total_likes = serializers.SerializerMethodField()
    user_liked = serializers.SerializerMethodField()

    class Meta:
        model = FlashcardSet
        fields = ['id', 'title', 'cards', 'total_likes', 'user_liked', 'course_mode']

    def get_total_likes(self, obj):
        return obj.likes.count()

    def get_user_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(id=request.user.id).exists()
        return False