from django.urls import path

from .views import SubscriptionCancelView, SubscriptionCheckoutView, SubscriptionOverviewView, SubscriptionPaymentRetryView, SubscriptionPaymentsView, SubscriptionReactivateView

urlpatterns = [
    path("", SubscriptionOverviewView.as_view(), name="subscription-overview"),
    path("checkout/", SubscriptionCheckoutView.as_view(), name="subscription-checkout"),
    path("payments/", SubscriptionPaymentsView.as_view(), name="subscription-payments"),
    path("payments/<int:payment_id>/retry/", SubscriptionPaymentRetryView.as_view(), name="subscription-payment-retry"),
    path("cancel/", SubscriptionCancelView.as_view(), name="subscription-cancel"),
    path("reactivate/", SubscriptionReactivateView.as_view(), name="subscription-reactivate"),
]
