import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { workspacePath } from "@/lib/workspace/routing";
import { ProjectForm } from "./project-form";

export function ProjectNewView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  return (
    <main className="mx-auto grid w-full max-w-4xl gap-5 overflow-x-hidden p-4 pb-24 md:p-0">
      <PageHeader
        title="Nouveau projet"
        description="Creez un projet et definissez son responsable, son planning et son budget."
        actions={<Button asChild variant="outline"><a href={workspacePath(workspaceSlug, "projects")}><ArrowLeft className="size-4" /> Retour</a></Button>}
      />
      <ProjectForm workspaceSlug={workspaceSlug} />
    </main>
  );
}
