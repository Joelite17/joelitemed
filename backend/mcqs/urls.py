from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MCQSetViewSet, UserScoreViewSet, report_mcq, UserReportedQuestionsView, ReportFeedbackView, SingleMCQView

router = DefaultRouter()
router.register(r'', MCQSetViewSet, basename='mcqsets')

urlpatterns = [
    path('report/<int:mcq_id>/', report_mcq, name='report-mcq'),
    path('my-reports/', UserReportedQuestionsView.as_view(), name='user-reports'),
    path('report-feedback/<int:report_id>/', ReportFeedbackView.as_view(), name='report-feedback'),
    path('question/<int:pk>/', SingleMCQView.as_view(), name='single-mcq'),
    path('', include(router.urls)),
]