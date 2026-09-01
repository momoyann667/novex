import { EventNewView } from "@/features/events/event-new-view";

export default async function NewEventPage({ params }: Readonly<{ params: Promise<{ workspace: string }> }>) {
  const { workspace } = await params;
  return <EventNewView workspaceSlug={workspace} />;
}
