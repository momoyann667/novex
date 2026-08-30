import { ProjectTasksView } from "@/features/projects/project-tasks-view";

export default function ProjectTasksPage({ params }: Readonly<{ params: { workspace: string; projectId: string } }>) {
  return <ProjectTasksView projectId={params.projectId} workspaceSlug={params.workspace} />;
}

