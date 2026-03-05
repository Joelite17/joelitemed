from rest_framework import serializers
from .models import Note

class NoteSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True)
    total_likes = serializers.SerializerMethodField()
    user_liked = serializers.SerializerMethodField()
    author = serializers.IntegerField(source='user.id', read_only=True)

    class Meta:
        model = Note
        fields = [
            "id", "title", "content", "user", "user_username", "author",
            "visibility", "created_at", "updated_at", "total_likes", "user_liked",
            "course_mode"
        ]
        read_only_fields = ["id", "user", "created_at", "updated_at"]

    def get_total_likes(self, obj):
        return obj.likes.count()

    def get_user_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(id=request.user.id).exists()
        return False