from rest_framework import decorators, response, status, viewsets

from common.permissions.workspace import RequireWorkspacePermission
from .serializers import AIConversationCreateSerializer, AIConversationSerializer, AIMessageCreateSerializer, AIMessageSerializer
from .services import conversation_queryset, create_conversation, current_workspace, send_message


class AIConversationViewSet(viewsets.ModelViewSet):
    serializer_class = AIConversationSerializer
    permission_classes = [RequireWorkspacePermission.for_permission("assistant.view")]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        return conversation_queryset(workspace=current_workspace(self.request), user=self.request.user).prefetch_related("messages")

    def create(self, request, *args, **kwargs):
        serializer = AIConversationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        conversation = create_conversation(workspace=current_workspace(request), user=request.user, **serializer.validated_data)
        return response.Response(self.get_serializer(conversation).data, status=status.HTTP_201_CREATED)

    @decorators.action(detail=True, methods=["post"])
    def messages(self, request, pk=None):
        serializer = AIMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            assistant_message = send_message(conversation=self.get_object(), user=request.user, **serializer.validated_data)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        return response.Response(AIMessageSerializer(assistant_message).data, status=status.HTTP_201_CREATED)
