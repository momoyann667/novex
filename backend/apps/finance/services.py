from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncDay, TruncMonth, TruncWeek
from django.utils import timezone

from apps.audit_logs.models import AuditLog
from apps.payments.statuses import PaymentStatus
from apps.workspaces.models import Workspace
from .models import FinancialCategory, FinancialSettings, FinancialTransaction, FinancialTransactionDocument, FiscalPeriod
from .statuses import FinancialCategoryKind, FinancialTransactionSource, FinancialTransactionStatus, FinancialTransactionType, FiscalPeriodStatus


ZERO = Decimal("0.00")

DEFAULT_INCOME_CATEGORIES = ["Cotisations", "Dons", "Subventions", "Sponsors", "Ventes", "Billetterie", "Prestations", "Autres"]
DEFAULT_EXPENSE_CATEGORIES = ["Transport", "Communication", "Fournitures", "Location", "Evenements", "Projets", "Prestations", "Maintenance", "Administration", "Autres"]
MAX_FINANCIAL_DOCUMENT_BYTES = 10 * 1024 * 1024
ALLOWED_FINANCIAL_DOCUMENT_MIME_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp"}
ALLOWED_FINANCIAL_DOCUMENT_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}


def financial_settings(workspace: Workspace) -> FinancialSettings:
    settings, _created = FinancialSettings.objects.get_or_create(workspace=workspace)
    return settings


def ensure_default_categories(workspace: Workspace, actor=None) -> None:
    for name in DEFAULT_INCOME_CATEGORIES:
        FinancialCategory.objects.get_or_create(
            workspace=workspace,
            kind=FinancialCategoryKind.INCOME_CATEGORY,
            name=name,
            defaults={"is_default": True, "created_by": actor},
        )
    for name in DEFAULT_EXPENSE_CATEGORIES:
        FinancialCategory.objects.get_or_create(
            workspace=workspace,
            kind=FinancialCategoryKind.EXPENSE_CATEGORY,
            name=name,
            defaults={"is_default": True, "created_by": actor},
        )


def default_category(workspace: Workspace, *, kind: str, name: str, actor=None) -> FinancialCategory:
    ensure_default_categories(workspace, actor=actor)
    category, _created = FinancialCategory.objects.get_or_create(
        workspace=workspace,
        kind=kind,
        name=name,
        defaults={"is_default": True, "created_by": actor},
    )
    return category


def validate_workspace_relation(workspace: Workspace, item, field: str) -> None:
    if item and item.workspace_id != workspace.id:
        raise ValueError(f"{field} appartient a un autre workspace.")


def period_is_closed(workspace: Workspace, transaction_date) -> bool:
    return FiscalPeriod.objects.filter(workspace=workspace, status=FiscalPeriodStatus.CLOSED, start_date__lte=transaction_date, end_date__gte=transaction_date).exists()


def build_transaction_reference(prefix: str = "FIN") -> str:
    return f"{prefix}-{timezone.now():%Y}-{timezone.now().timestamp():.0f}"


@transaction.atomic
def create_financial_transaction(*, workspace: Workspace, actor, transaction_type: str, **data) -> FinancialTransaction:
    category = data.get("category")
    project = data.get("project")
    event = data.get("event")
    cost_center = data.get("cost_center")
    source_payment = data.get("source_payment")
    validate_workspace_relation(workspace, category, "La categorie")
    validate_workspace_relation(workspace, project, "Le projet")
    validate_workspace_relation(workspace, event, "L'evenement")
    validate_workspace_relation(workspace, cost_center, "Le centre de cout")
    validate_workspace_relation(workspace, source_payment, "Le paiement")
    if category and transaction_type == FinancialTransactionType.INCOME and category.kind != FinancialCategoryKind.INCOME_CATEGORY:
        raise ValueError("La categorie doit etre une categorie de recette.")
    if category and transaction_type == FinancialTransactionType.EXPENSE and category.kind != FinancialCategoryKind.EXPENSE_CATEGORY:
        raise ValueError("La categorie doit etre une categorie de depense.")
    amount = data.get("amount") or ZERO
    if amount <= ZERO:
        raise ValueError("Le montant doit etre positif.")
    transaction_date = data.get("transaction_date") or timezone.localdate()
    if period_is_closed(workspace, transaction_date):
        raise ValueError("La periode comptable est cloturee.")
    settings = financial_settings(workspace)
    if transaction_type == FinancialTransactionType.EXPENSE:
        data["requires_receipt"] = bool(data.get("requires_receipt") or settings.require_expense_receipt)
        if data.get("status") != FinancialTransactionStatus.DRAFT and amount >= settings.expense_validation_threshold:
            data["status"] = FinancialTransactionStatus.PENDING
    data.setdefault("currency", workspace.currency)
    data.setdefault("reference", build_transaction_reference("INC" if transaction_type == FinancialTransactionType.INCOME else "EXP"))
    transaction_obj = FinancialTransaction.objects.create(workspace=workspace, created_by=actor, transaction_type=transaction_type, **data)
    action = "income.created" if transaction_type == FinancialTransactionType.INCOME else "expense.created"
    AuditLog.objects.create(workspace=workspace, actor=actor, action=action, resource="financial_transaction", resource_id=str(transaction_obj.id), metadata={"amount": str(amount)})
    return transaction_obj


def create_income(*, workspace: Workspace, actor, **data) -> FinancialTransaction:
    return create_financial_transaction(workspace=workspace, actor=actor, transaction_type=FinancialTransactionType.INCOME, **data)


def create_expense(*, workspace: Workspace, actor, **data) -> FinancialTransaction:
    return create_financial_transaction(workspace=workspace, actor=actor, transaction_type=FinancialTransactionType.EXPENSE, **data)


def validate_financial_document_file(file_obj) -> tuple[str, int]:
    size = getattr(file_obj, "size", 0) or 0
    name = getattr(file_obj, "name", "")
    extension = "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""
    mime_type = getattr(file_obj, "content_type", "") or ""
    if size > MAX_FINANCIAL_DOCUMENT_BYTES:
        raise ValueError("Le fichier depasse la taille maximale autorisee.")
    if extension not in ALLOWED_FINANCIAL_DOCUMENT_EXTENSIONS:
        raise ValueError("Extension de fichier non autorisee.")
    if mime_type not in ALLOWED_FINANCIAL_DOCUMENT_MIME_TYPES:
        raise ValueError("Type MIME non autorise.")
    return mime_type, size


@transaction.atomic
def attach_transaction_document(*, transaction_obj: FinancialTransaction, actor, title: str, file, document_type: str) -> FinancialTransactionDocument:
    transaction_obj = FinancialTransaction.objects.select_for_update().get(id=transaction_obj.id)
    mime_type, size = validate_financial_document_file(file)
    document = FinancialTransactionDocument.objects.create(
        workspace=transaction_obj.workspace,
        transaction=transaction_obj,
        title=title,
        file=file,
        document_type=document_type,
        mime_type=mime_type,
        size_bytes=size,
        uploaded_by=actor,
    )
    AuditLog.objects.create(
        workspace=transaction_obj.workspace,
        actor=actor,
        action="finance_document.uploaded",
        resource="financial_transaction",
        resource_id=str(transaction_obj.id),
        metadata={"document_id": document.id, "mime_type": mime_type},
    )
    return document


@transaction.atomic
def sync_payment_to_finance(*, payment, actor=None) -> FinancialTransaction | None:
    payment = payment.__class__.objects.select_for_update().select_related("workspace", "contribution", "member").get(id=payment.id)
    if payment.status != PaymentStatus.SUCCESS:
        return None
    category = default_category(payment.workspace, kind=FinancialCategoryKind.INCOME_CATEGORY, name="Cotisations", actor=actor)
    transaction_obj, created = FinancialTransaction.objects.get_or_create(
        workspace=payment.workspace,
        source_payment=payment,
        defaults={
            "transaction_type": FinancialTransactionType.INCOME,
            "amount": payment.amount,
            "currency": payment.currency,
            "category": category,
            "description": f"Cotisation {payment.member}",
            "reference": f"PAY-{payment.reference}",
            "transaction_date": (payment.paid_at or timezone.now()).date(),
            "status": FinancialTransactionStatus.VALIDATED,
            "source": FinancialTransactionSource.PAYMENT,
            "created_by": actor,
        },
    )
    if created:
        AuditLog.objects.create(
            workspace=payment.workspace,
            actor=actor,
            action="finance.payment_synced",
            resource="financial_transaction",
            resource_id=str(transaction_obj.id),
            metadata={"payment_id": payment.id, "reference": payment.reference},
        )
    return transaction_obj


@transaction.atomic
def validate_expense(*, transaction_obj: FinancialTransaction, actor) -> FinancialTransaction:
    transaction_obj = FinancialTransaction.objects.select_for_update().get(id=transaction_obj.id)
    if transaction_obj.transaction_type != FinancialTransactionType.EXPENSE:
        raise ValueError("Seules les depenses peuvent etre validees par ce flux.")
    if transaction_obj.requires_receipt and not transaction_obj.documents.exists():
        raise ValueError("Un justificatif est requis avant validation.")
    if period_is_closed(transaction_obj.workspace, transaction_obj.transaction_date):
        raise ValueError("La periode comptable est cloturee.")
    transaction_obj.status = FinancialTransactionStatus.VALIDATED
    transaction_obj.save(update_fields=["status", "updated_at"])
    AuditLog.objects.create(workspace=transaction_obj.workspace, actor=actor, action="expense.validated", resource="financial_transaction", resource_id=str(transaction_obj.id))
    return transaction_obj


@transaction.atomic
def cancel_transaction(*, transaction_obj: FinancialTransaction, actor, reason: str) -> FinancialTransaction:
    transaction_obj = FinancialTransaction.objects.select_for_update().get(id=transaction_obj.id)
    if period_is_closed(transaction_obj.workspace, transaction_obj.transaction_date):
        raise ValueError("La periode comptable est cloturee.")
    transaction_obj.status = FinancialTransactionStatus.CANCELLED
    transaction_obj.cancellation_reason = reason
    transaction_obj.cancelled_by = actor
    transaction_obj.cancelled_at = timezone.now()
    transaction_obj.save(update_fields=["status", "cancellation_reason", "cancelled_by", "cancelled_at", "updated_at"])
    action = "income.cancelled" if transaction_obj.transaction_type == FinancialTransactionType.INCOME else "expense.cancelled"
    AuditLog.objects.create(workspace=transaction_obj.workspace, actor=actor, action=action, resource="financial_transaction", resource_id=str(transaction_obj.id), metadata={"reason": reason})
    return transaction_obj


def finance_totals(queryset) -> dict:
    data = queryset.filter(status=FinancialTransactionStatus.VALIDATED).aggregate(
        income=Sum("amount", filter=Q(transaction_type=FinancialTransactionType.INCOME)),
        expense=Sum("amount", filter=Q(transaction_type=FinancialTransactionType.EXPENSE)),
        average_income=Avg("amount", filter=Q(transaction_type=FinancialTransactionType.INCOME)),
        average_expense=Avg("amount", filter=Q(transaction_type=FinancialTransactionType.EXPENSE)),
        largest_income=MaxAmount(FinancialTransactionType.INCOME),
        largest_expense=MaxAmount(FinancialTransactionType.EXPENSE),
    )
    income = data["income"] or ZERO
    expense = data["expense"] or ZERO
    return {**data, "income": income, "expense": expense, "net_cashflow": income - expense}


def MaxAmount(transaction_type: str):
    from django.db.models import Max

    return Max("amount", filter=Q(transaction_type=transaction_type))


def finance_dashboard(*, workspace: Workspace, range_code: str | None = "30d", group_by: str | None = "day") -> dict:
    ensure_default_categories(workspace)
    queryset = FinancialTransaction.objects.filter(workspace=workspace).select_related("category")
    today = timezone.localdate()
    month_start = today.replace(day=1)
    previous_month_end = month_start - timedelta(days=1)
    previous_month_start = previous_month_end.replace(day=1)
    totals = finance_totals(queryset)
    month = finance_totals(queryset.filter(transaction_date__gte=month_start))
    previous_month = finance_totals(queryset.filter(transaction_date__gte=previous_month_start, transaction_date__lte=previous_month_end))
    income_growth = growth(month["income"], previous_month["income"])
    expense_growth = growth(month["expense"], previous_month["expense"])
    return {
        "available_balance": totals["net_cashflow"],
        "total_income": totals["income"],
        "total_expense": totals["expense"],
        "net_cashflow": totals["net_cashflow"],
        "month_income": month["income"],
        "month_expense": month["expense"],
        "income_growth": income_growth,
        "expense_growth": expense_growth,
        "expense_income_ratio": round((totals["expense"] / totals["income"]) * 100, 2) if totals["income"] else 0,
        "monthly_average": (month["income"] - month["expense"]),
        "largest_income": totals["largest_income"] or ZERO,
        "largest_expense": totals["largest_expense"] or ZERO,
        "series": finance_series(workspace=workspace, range_code=range_code, group_by=group_by),
        "income_breakdown": category_breakdown(workspace=workspace, transaction_type=FinancialTransactionType.INCOME),
        "expense_breakdown": category_breakdown(workspace=workspace, transaction_type=FinancialTransactionType.EXPENSE),
        "alerts": finance_alerts(workspace=workspace),
    }


def growth(current: Decimal, previous: Decimal) -> dict:
    if not previous:
        return {"value": None if current else 0, "direction": "flat"}
    value = round(((current - previous) / previous) * 100, 2)
    return {"value": value, "direction": "up" if value > 0 else "down" if value < 0 else "flat"}


def finance_series(*, workspace: Workspace, range_code: str | None, group_by: str | None) -> list[dict]:
    days_by_range = {"7d": 7, "30d": 30, "3m": 90, "6m": 180, "12m": 365}
    start = timezone.localdate() - timedelta(days=days_by_range.get(range_code or "30d", 30))
    trunc = TruncMonth("transaction_date") if group_by == "month" else TruncWeek("transaction_date") if group_by == "week" else TruncDay("transaction_date")
    rows = (
        FinancialTransaction.objects.filter(workspace=workspace, status=FinancialTransactionStatus.VALIDATED, transaction_date__gte=start)
        .annotate(bucket=trunc)
        .values("bucket")
        .annotate(
            income=Sum("amount", filter=Q(transaction_type=FinancialTransactionType.INCOME)),
            expense=Sum("amount", filter=Q(transaction_type=FinancialTransactionType.EXPENSE)),
        )
        .order_by("bucket")
    )
    return [{"period": row["bucket"].isoformat(), "income": row["income"] or ZERO, "expense": row["expense"] or ZERO, "net": (row["income"] or ZERO) - (row["expense"] or ZERO)} for row in rows]


def category_breakdown(*, workspace: Workspace, transaction_type: str) -> list[dict]:
    rows = (
        FinancialTransaction.objects.filter(workspace=workspace, status=FinancialTransactionStatus.VALIDATED, transaction_type=transaction_type)
        .values("category__name")
        .annotate(amount=Sum("amount"), count=Count("id"))
        .order_by("-amount")
    )
    total = sum((row["amount"] or ZERO for row in rows), ZERO)
    return [{"category": row["category__name"], "amount": row["amount"] or ZERO, "count": row["count"], "percentage": round(((row["amount"] or ZERO) / total) * 100, 2) if total else 0} for row in rows]


def finance_alerts(*, workspace: Workspace) -> list[dict]:
    settings = financial_settings(workspace)
    alerts = []
    large_expenses = FinancialTransaction.objects.filter(workspace=workspace, transaction_type=FinancialTransactionType.EXPENSE, status=FinancialTransactionStatus.VALIDATED, amount__gte=settings.large_expense_threshold).count()
    pending_expenses = FinancialTransaction.objects.filter(workspace=workspace, transaction_type=FinancialTransactionType.EXPENSE, status=FinancialTransactionStatus.PENDING).count()
    missing_receipts = FinancialTransaction.objects.filter(workspace=workspace, transaction_type=FinancialTransactionType.EXPENSE, requires_receipt=True, documents__isnull=True).count()
    if large_expenses:
        alerts.append({"type": "large_expense", "label": "Depense importante", "count": large_expenses})
    if pending_expenses:
        alerts.append({"type": "pending_validation", "label": "Depenses a valider", "count": pending_expenses})
    if missing_receipts:
        alerts.append({"type": "missing_receipt", "label": "Justificatifs manquants", "count": missing_receipts})
    return alerts


def finance_journal(*, workspace: Workspace, filters: dict | None = None) -> list[dict]:
    filters = filters or {}
    queryset = FinancialTransaction.objects.filter(workspace=workspace).select_related("category", "created_by").order_by("-transaction_date", "-created_at")
    if filters.get("date_from"):
        queryset = queryset.filter(transaction_date__gte=filters["date_from"])
    if filters.get("date_to"):
        queryset = queryset.filter(transaction_date__lte=filters["date_to"])
    for key, field in {"type": "transaction_type", "category": "category_id", "source": "source", "project": "project_id", "event": "event_id", "status": "status"}.items():
        if filters.get(key):
            queryset = queryset.filter(**{field: filters[key]})
    if filters.get("amount_min"):
        queryset = queryset.filter(amount__gte=filters["amount_min"])
    if filters.get("amount_max"):
        queryset = queryset.filter(amount__lte=filters["amount_max"])
    if filters.get("reference"):
        queryset = queryset.filter(Q(reference__icontains=filters["reference"]) | Q(description__icontains=filters["reference"]) | Q(category__name__icontains=filters["reference"]) | Q(supplier_name__icontains=filters["reference"]))
    return [
        {
            "date": item.transaction_date,
            "type": item.transaction_type,
            "description": item.description,
            "category": item.category.name,
            "entry": item.amount if item.transaction_type == FinancialTransactionType.INCOME and item.status == FinancialTransactionStatus.VALIDATED else ZERO,
            "out": item.amount if item.transaction_type == FinancialTransactionType.EXPENSE and item.status == FinancialTransactionStatus.VALIDATED else ZERO,
            "reference": item.reference,
            "source": item.source,
            "status": item.status,
            "user": str(item.created_by or ""),
        }
        for item in queryset
    ]


@transaction.atomic
def close_fiscal_period(*, period: FiscalPeriod, actor) -> FiscalPeriod:
    period = FiscalPeriod.objects.select_for_update().get(id=period.id)
    if period.status == FiscalPeriodStatus.CLOSED:
        return period
    qs = FinancialTransaction.objects.filter(workspace=period.workspace, transaction_date__gte=period.start_date, transaction_date__lte=period.end_date)
    totals = finance_totals(qs)
    period.status = FiscalPeriodStatus.CLOSED
    period.closing_summary = {
        "total_income": str(totals["income"]),
        "total_expense": str(totals["expense"]),
        "balance": str(totals["net_cashflow"]),
        "transaction_count": qs.count(),
    }
    period.closed_by = actor
    period.closed_at = timezone.now()
    period.save(update_fields=["status", "closing_summary", "closed_by", "closed_at", "updated_at"])
    AuditLog.objects.create(workspace=period.workspace, actor=actor, action="fiscal_period.closed", resource="fiscal_period", resource_id=str(period.id), metadata=period.closing_summary)
    return period
