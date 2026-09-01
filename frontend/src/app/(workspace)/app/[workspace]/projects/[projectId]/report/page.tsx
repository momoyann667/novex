import { ProjectReportView } from "@/features/projects/project-report-view";

export default async function ProjectReportPage({ params }: Readonly<{ params: Promise<{ workspace: string; projectId: string }> }>) {
  const { workspace, projectId } = await params;
  return <ProjectReportView projectId={projectId} workspaceSlug={workspace} />;
}
