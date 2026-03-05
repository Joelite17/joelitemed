# osces/serializers.py
from rest_framework import serializers
from .models import OSCESet, OSCECard, OSCEQuestion, OSCEAnswer

class OSCEAnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = OSCEAnswer
        fields = ["text"]

class OSCEQuestionSerializer(serializers.ModelSerializer):
    answer = serializers.SerializerMethodField()

    class Meta:
        model = OSCEQuestion
        fields = ["question_number", "text", "answer"]

    def get_answer(self, obj):
        return obj.answer.text if hasattr(obj, "answer") else ""
        
class OSCECardSerializer(serializers.ModelSerializer):
    questions = serializers.SerializerMethodField()
    answers = serializers.SerializerMethodField()

    class Meta:
        model = OSCECard
        fields = ["id", "title", "image", "explanation", "questions", "answers"]

    def get_questions(self, obj):
        return [q.text for q in obj.questions.all()]

    def get_answers(self, obj):
        return [
            [a.text for a in q.answers.all()]
            for q in obj.questions.all()
        ]



class OSCESetSerializer(serializers.ModelSerializer):
    cards = OSCECardSerializer(many=True, read_only=True)
    total_likes = serializers.IntegerField(read_only=True)
    user_liked = serializers.SerializerMethodField()

    class Meta:
        model = OSCESet
        fields = ["id", "title", "cards", "total_likes", "user_liked"]

    def get_total_likes(self, obj):
        return obj.likes.count()

    def get_user_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(id=request.user.id).exists()
        return False