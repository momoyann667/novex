import { ContributionsView } from "@/features/contributions/contributions-view";

export default async function ContributionsPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <ContributionsView workspaceSlug={workspace} />;
}
