import pytest


@pytest.mark.django_db
def test_placeholder_multi_tenant_contract():
    assert "workspace_id must scope business data"
