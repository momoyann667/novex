import { ProjectsView } from "@/features/projects/projects-view";

export default function ProjectsPage({ params }: Readonly<{ params: { workspace: string } }>) {
  return <ProjectsView workspaceSlug={params.workspace} />;
}
