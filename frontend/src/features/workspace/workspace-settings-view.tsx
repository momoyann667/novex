"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { WorkspaceProfile, WorkspaceProfileSetup } from "./workspace-profile";

export function WorkspaceSettingsView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const [savedProfile, setSavedProfile] = useState<WorkspaceProfile | null>(null);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {savedProfile ? (
        <div className="mx-auto mb-4 flex max-w-[420px] items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          <CheckCircle2 className="size-4" />
          Parametres de {savedProfile.associationName} enregistres.
        </div>
      ) : null}
      <WorkspaceProfileSetup mode="settings" workspaceSlug={workspaceSlug} onComplete={setSavedProfile} />
    </div>
  );
}
