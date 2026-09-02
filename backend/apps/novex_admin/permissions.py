from rest_framework.permissions import BasePermission


class IsNovexAdmin(BasePermission):
    message = "Acces reserve a l'equipe NOVEX."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_staff and user.is_superuser)
