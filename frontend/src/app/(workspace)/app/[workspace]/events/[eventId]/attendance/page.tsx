import { EventAttendanceView } from "@/features/events/event-attendance-view";

export default function EventAttendancePage({ params }: Readonly<{ params: { workspace: string; eventId: string } }>) {
  return <EventAttendanceView eventId={params.eventId} workspaceSlug={params.workspace} />;
}

