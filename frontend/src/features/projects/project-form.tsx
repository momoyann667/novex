"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Save, Users, WalletCards, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { workspacePath } from "@/lib/workspace/routing";
import { addProjectMember, createProject, listMemberOptions, type MemberOption, type ProjectPriority } from "./api";
import { PROJECT_PRIORITIES } from "./project-status";

const categories = ["Environnement", "Social", "Education", "Sante", "Evenementiel", "Communication", "Developpement", "Autre"];

function memberName(member: MemberOption) {
  return member.full_name || `${member.first_name} ${member.last_name}`.trim() || `Membre ${member.id}`;
}

export function ProjectForm({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const router = useRouter();
  const membersQuery = useQuery({ queryKey: ["project-member-options", workspaceSlug], queryFn: () => listMemberOptions(workspaceSlug) });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [responsibleMember, setResponsibleMember] = useState("");
  const [collaborators, setCollaborators] = useState<number[]>([]);
  const [category, setCategory] = useState("Social");
  const [priority, setPriority] = useState<ProjectPriority>("MEDIUM");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [error, setError] = useState("");

  const members = membersQuery.data || [];
  const selectedCollaborators = useMemo(() => members.filter((member) => collaborators.includes(member.id)), [members, collaborators]);
  const canSubmit = name.trim().length >= 2 && !membersQuery.isLoading;

  const mutation = useMutation({
    mutationFn: async () => {
      const responsibleId = responsibleMember ? Number(responsibleMember) : null;
      const project = await createProject(workspaceSlug, {
        name: name.trim(),
        description: description.trim(),
        responsible_member: responsibleId,
        owner: responsibleId,
        category,
        priority,
        status: "ACTIVE",
        start_date: startDate || null,
        end_date: endDate || null,
        budget: Number(budget || 0)
      });
      const uniqueCollaborators = [...new Set([...collaborators, ...(responsibleId ? [responsibleId] : [])])];
      await Promise.all(uniqueCollaborators.map((memberId) => addProjectMember(workspaceSlug, project.id, { member: memberId, role: memberId === responsibleId ? "PROJECT_MANAGER" : "MEMBER" })));
      return project;
    },
    onSuccess: (project) => {
      router.push(workspacePath(workspaceSlug, `projects/${project.id}`));
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Impossible de creer le projet.");
    }
  });

  function toggleCollaborator(memberId: number) {
    setCollaborators((current) => (current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]));
  }

  return (
    <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); setError(""); if (canSubmit) mutation.mutate(); }}>
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <Users className="size-5 text-blue-700" />
          <h2 className="text-lg font-black text-slate-950">Informations generales</h2>
        </div>
        <div className="grid gap-4">
          <label className="grid gap-1 text-sm font-bold">
            Nom du projet *
            <input className="min-h-12 rounded-md border border-slate-200 px-3 text-base outline-none focus:border-blue-600" maxLength={180} placeholder="Campagne de reboisement 2026" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Description
            <textarea className="min-h-28 rounded-md border border-slate-200 px-3 py-2 text-base outline-none focus:border-blue-600" placeholder="Objectif, programme et contexte du projet..." value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-bold">
              Responsable
              <select className="min-h-12 rounded-md border border-slate-200 px-3 text-base outline-none focus:border-blue-600" value={responsibleMember} onChange={(event) => setResponsibleMember(event.target.value)}>
                <option value="">Choisir un membre</option>
                {members.map((member) => <option key={member.id} value={member.id}>{memberName(member)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Categorie
              <select className="min-h-12 rounded-md border border-slate-200 px-3 text-base outline-none focus:border-blue-600" value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <div className="grid gap-2">
            <span className="text-sm font-bold">Collaborateurs</span>
            <div className="grid max-h-56 gap-2 overflow-y-auto rounded-md border border-slate-200 p-2">
              {members.map((member) => (
                <button className="flex min-h-11 items-center justify-between rounded-md px-3 text-left text-sm font-semibold hover:bg-slate-50" key={member.id} type="button" onClick={() => toggleCollaborator(member.id)}>
                  <span>{memberName(member)}</span>
                  <span className={`grid size-6 place-items-center rounded-full border ${collaborators.includes(member.id) ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 text-transparent"}`}><Check className="size-4" /></span>
                </button>
              ))}
              {!members.length ? <p className="p-3 text-sm text-slate-500">{membersQuery.isLoading ? "Chargement des membres..." : "Aucun membre disponible."}</p> : null}
            </div>
            {selectedCollaborators.length ? (
              <div className="flex flex-wrap gap-2">
                {selectedCollaborators.map((member) => (
                  <button className="inline-flex min-h-8 items-center gap-2 rounded-full bg-blue-50 px-3 text-xs font-black text-blue-700" key={member.id} type="button" onClick={() => toggleCollaborator(member.id)}>
                    {memberName(member)}
                    <X className="size-3" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <WalletCards className="size-5 text-blue-700" />
          <h2 className="text-lg font-black text-slate-950">Planning et budget</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-bold">
            Priorite
            <select className="min-h-12 rounded-md border border-slate-200 px-3 text-base outline-none focus:border-blue-600" value={priority} onChange={(event) => setPriority(event.target.value as ProjectPriority)}>
              {PROJECT_PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Budget alloue
            <input className="min-h-12 rounded-md border border-slate-200 px-3 text-base outline-none focus:border-blue-600" min={0} placeholder="0 si sans budget" step="100" type="number" value={budget} onChange={(event) => setBudget(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Date de debut
            <input className="min-h-12 rounded-md border border-slate-200 px-3 text-base outline-none focus:border-blue-600" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Date de fin
            <input className="min-h-12 rounded-md border border-slate-200 px-3 text-base outline-none focus:border-blue-600" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>
      </section>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Button asChild className="min-h-12" variant="outline"><a href={workspacePath(workspaceSlug, "projects")}><ArrowLeft className="size-4" /> Annuler</a></Button>
        <Button className="min-h-12" disabled={!canSubmit || mutation.isPending} type="submit"><Save className="size-4" /> Creer le projet</Button>
      </div>
    </form>
  );
}
