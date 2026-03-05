from django.apps import AppConfig

class McqsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'mcqs'

    def ready(self):
        import mcqs.signals  # noqa