import { ProjectsView } from "@/features/projects/projects-view";

export default async function ProjectsPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <ProjectsView workspaceSlug={workspace} />;
}
