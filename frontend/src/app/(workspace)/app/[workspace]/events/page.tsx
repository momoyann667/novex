import { EventsView } from "@/features/events/events-view";

export default async function EventsPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <EventsView workspaceSlug={workspace} />;
}
