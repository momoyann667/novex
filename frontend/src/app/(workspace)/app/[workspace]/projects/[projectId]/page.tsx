import { ProjectDetailView } from "@/features/projects/project-detail-view";

export default async function ProjectDetailPage({ params }: Readonly<{ params: Promise<{ workspace: string; projectId: string }> }>) {
  const { workspace, projectId } = await params;
  return <ProjectDetailView projectId={projectId} workspaceSlug={workspace} />;
}
