import { ProjectNewView } from "@/features/projects/project-new-view";

export default async function NewProjectPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <ProjectNewView workspaceSlug={workspace} />;
}
