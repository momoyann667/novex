import { ProjectReportView } from "@/features/projects/project-report-view";

export default function ProjectReportPage({ params }: Readonly<{ params: { workspace: string; projectId: string } }>) {
  return <ProjectReportView projectId={params.projectId} workspaceSlug={params.workspace} />;
}
