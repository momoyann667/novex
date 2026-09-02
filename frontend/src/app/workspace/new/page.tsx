import { WorkspaceProfileSetup } from "@/features/workspace/workspace-profile";

export default function NewWorkspacePage() {
  return <WorkspaceProfileSetup mode="create" workspaceSlug="__new__" />;
}
