from django.urls import path

from .views import SubscriptionCancelView, SubscriptionCheckoutView, SubscriptionOverviewView, SubscriptionReactivateView

urlpatterns = [
    path("", SubscriptionOverviewView.as_view(), name="subscription-overview"),
    path("checkout/", SubscriptionCheckoutView.as_view(), name="subscription-checkout"),
    path("cancel/", SubscriptionCancelView.as_view(), name="subscription-cancel"),
    path("reactivate/", SubscriptionReactivateView.as_view(), name="subscription-reactivate"),
]
