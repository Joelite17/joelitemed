from django.apps import AppConfig

class OscesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'osces'

    def ready(self):
        import osces.signals  # noqa