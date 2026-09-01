import { ProjectTasksView } from "@/features/projects/project-tasks-view";

export default async function ProjectTasksPage({ params }: Readonly<{ params: Promise<{ workspace: string; projectId: string }> }>) {
  const { workspace, projectId } = await params;
  return <ProjectTasksView projectId={projectId} workspaceSlug={workspace} />;
}
