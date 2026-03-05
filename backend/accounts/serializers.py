from django.contrib.auth import get_user_model, authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'dark_mode', 'course_mode']
        extra_kwargs = {
            'username': {'read_only': True},
            'course_mode': {'required': False, 'allow_null': True}
        }

    def validate_email(self, value):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            user = request.user
            if value != user.email and User.objects.filter(email=value).exists():
                raise serializers.ValidationError("This email is already associated with another account.")
        return value


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password1 = serializers.CharField(write_only=True)
    password2 = serializers.CharField(write_only=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already exists.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already exists.")
        return value

    def validate(self, data):
        if data["password1"] != data["password2"]:
            raise serializers.ValidationError("Passwords do not match.")
        return data

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],                         
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
            email=validated_data["email"],
            password=validated_data["password1"],
        )
        return user

class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(required=True)
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        identifier = data.get("identifier")
        password = data.get("password")
        if identifier and password:
            # try username first
            user = authenticate(username=identifier, password=password)
            if not user and "@" in identifier:
                # try email
                try:
                    u = User.objects.get(email=identifier)
                    user = authenticate(username=u.username, password=password)
                except User.DoesNotExist:
                    user = None
            if not user:
                raise serializers.ValidationError("Invalid credentials.")
            data["user"] = user
            return data
        raise serializers.ValidationError("Must include identifier and password.")

class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

class SetNewPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True)
    password2 = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError("Passwords do not match.")
        validate_password(attrs["password"])
        return attrs

class UpdateDarkModeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['dark_mode']