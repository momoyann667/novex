import { ProjectDetailView } from "@/features/projects/project-detail-view";

export default function ProjectDetailPage({ params }: Readonly<{ params: { projectId: string } }>) {
  return <ProjectDetailView projectId={params.projectId} />;
}
