from rest_framework import serializers


class SubscriptionCheckoutSerializer(serializers.Serializer):
    plan = serializers.ChoiceField(choices=["NOVEX_START", "NOVEX_PRO"])


class SubscriptionPlanSerializer(serializers.Serializer):
    code = serializers.CharField()
    name = serializers.CharField()
    description = serializers.CharField()
    price = serializers.DecimalField(max_digits=14, decimal_places=2)
    currency = serializers.CharField()
    billing_period = serializers.CharField()
    limits = serializers.DictField()
    quotas = serializers.ListField()
    entitlements = serializers.DictField()
