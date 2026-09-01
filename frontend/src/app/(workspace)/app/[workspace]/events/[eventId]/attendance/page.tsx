import { EventAttendanceView } from "@/features/events/event-attendance-view";

export default async function EventAttendancePage({ params }: Readonly<{ params: Promise<{ workspace: string; eventId: string }> }>) {
  const { workspace, eventId } = await params;
  return <EventAttendanceView eventId={eventId} workspaceSlug={workspace} />;
}
