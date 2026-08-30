from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import DocumentAnalyticsView, DocumentFolderViewSet, DocumentSearchView, DocumentTagViewSet, DocumentViewSet

router = DefaultRouter()
router.register("folders", DocumentFolderViewSet, basename="document-folder")
router.register("tags", DocumentTagViewSet, basename="document-tag")
router.register("", DocumentViewSet, basename="document")

urlpatterns = [
    path("analytics/", DocumentAnalyticsView.as_view(), name="document-analytics"),
    path("dashboard/", DocumentAnalyticsView.as_view(), name="document-dashboard"),
    path("search/", DocumentSearchView.as_view(), name="document-search"),
    *router.urls,
]
