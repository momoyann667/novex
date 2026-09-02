import { notFound } from "next/navigation";
import { AdminConsole } from "@/features/novex-admin/admin-console";
import type { AdminSection } from "@/features/novex-admin/api";

const sections = new Set(["associations", "users", "subscriptions", "payments", "plans", "activity", "audit", "reports", "settings"]);

export default async function AdminSectionPage({ params }: Readonly<{ params: Promise<{ section: string }> }>) {
  const { section } = await params;
  if (!sections.has(section)) notFound();
  return <AdminConsole section={section as AdminSection} />;
}
