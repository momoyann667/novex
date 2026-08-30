import { ProjectDetailView } from "@/features/projects/project-detail-view";

export default function ProjectDetailPage({ params }: Readonly<{ params: { workspace: string; projectId: string } }>) {
  return <ProjectDetailView projectId={params.projectId} workspaceSlug={params.workspace} />;
}
