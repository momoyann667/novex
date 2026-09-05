"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  Bell,
  Bot,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Mail,
  MoreVertical,
  Phone,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  TrendingUp,
  Upload,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiError } from "@/lib/api/client";
import { getWorkspaceSettings } from "@/features/workspace/api";
import { workspacePath } from "@/lib/workspace/routing";

type MemberStatus = "Actif" | "En attente" | "Inactif" | "Suspendu" | "Archive";
type ContributionStatus = "A jour" | "En retard" | "Partiel" | "Aucune cotisation";

type Member = {
  id: string;
  number: string;
  name: string;
  email: string;
  phone: string;
  function: string;
  profession: string;
  category: string;
  city: string;
  gender: string;
  joinedAt: string;
  status: MemberStatus;
  contribution: ContributionStatus;
  lastActivity: string;
  avatar: string;
};

const members: Member[] = [];

type ApiMember = {
  id: number;
  membership_number: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  email: string;
  phone: string;
  function: string;
  occupation: string;
  city: string;
  gender: string;
  join_date: string;
  status: string;
  category_detail?: { id: number; name: string } | null;
  groups_detail?: Array<{ id: number; name: string }>;
  contribution_status?: string;
};

type Paginated<T> = {
  results: T[];
};

const avatarStyles = [
  "bg-[linear-gradient(135deg,#0f172a,#64748b)]",
  "bg-[linear-gradient(135deg,#dbeafe,#334155)]",
  "bg-[linear-gradient(135deg,#ecfeff,#0f766e)]",
  "bg-[linear-gradient(135deg,#fee2e2,#7c2d12)]",
  "bg-[linear-gradient(135deg,#fef3c7,#92400e)]",
  "bg-[linear-gradient(135deg,#e0e7ff,#312e81)]"
];

const pageSizeOptions = [20, 50, 100];

const defaultMemberCategories = ["Membre du bureau", "Membre actif", "Membre honoraire", "Membre fondateur", "Membre bienfaiteur"];
const defaultMemberGroups = ["Bureau executif", "Commission finance", "Commission communication"];
const defaultMemberFunctions = ["President", "Tresorier", "Secretaire", "Responsable communication"];

const statusToApi: Record<MemberStatus, string> = {
  Actif: "active",
  "En attente": "pending",
  Inactif: "inactive",
  Suspendu: "suspended",
  Archive: "archived"
};

const apiToStatus: Record<string, MemberStatus> = {
  active: "Actif",
  pending: "En attente",
  inactive: "Inactif",
  suspended: "Suspendu",
  archived: "Archive"
};

const apiToContribution: Record<string, ContributionStatus> = {
  up_to_date: "A jour",
  overdue: "En retard",
  partial: "Partiel",
  pending: "Partiel",
  none: "Aucune cotisation"
};

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function stringPreference(source: Record<string, unknown> | undefined, key: string, fallback: string[]) {
  const value = source?.[key];
  return Array.isArray(value) ? uniqueStrings(value.filter((item): item is string => typeof item === "string")) : fallback;
}

function splitName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function mapApiMember(member: ApiMember, index = 0): Member {
  const name = member.full_name || `${member.first_name} ${member.last_name}`.trim() || "Membre";
  return {
    id: String(member.id),
    number: member.membership_number || `NVX-${String(member.id).padStart(4, "0")}`,
    name,
    email: member.email || "",
    phone: member.phone || "",
    function: member.function || "Membre",
    profession: member.occupation || "",
    category: member.category_detail?.name || "Membres",
    city: member.city || "",
    gender: member.gender || "Non precise",
    joinedAt: member.join_date || new Date().toISOString().slice(0, 10),
    status: apiToStatus[member.status] || "Actif",
    contribution: apiToContribution[member.contribution_status || "none"] || "Aucune cotisation",
    lastActivity: "Base de donnees",
    avatar: avatarStyles[index % avatarStyles.length]
  };
}

async function listMembers(workspaceSlug: string) {
  const payload = await apiFetch<ApiMember[] | Paginated<ApiMember>>("/members/?ordering=last_name", {
    headers: { "X-Workspace": workspaceSlug },
    cache: "no-store"
  });
  return ("results" in payload ? payload.results : payload).map(mapApiMember);
}

function statusClass(status: MemberStatus) {
  return {
    Actif: "bg-emerald-50 text-emerald-700",
    "En attente": "bg-blue-50 text-blue-700",
    Inactif: "bg-slate-100 text-slate-700",
    Suspendu: "bg-amber-50 text-amber-700",
    Archive: "bg-red-50 text-red-700"
  }[status];
}

function contributionClass(status: ContributionStatus) {
  return {
    "A jour": "bg-emerald-50 text-emerald-700",
    "En retard": "bg-red-50 text-red-700",
    Partiel: "bg-amber-50 text-amber-700",
    "Aucune cotisation": "bg-slate-100 text-slate-600"
  }[status];
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let isQuoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && isQuoted && nextCharacter === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      isQuoted = !isQuoted;
    } else if (character === "," && !isQuoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  values.push(current.trim());
  return values;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
}

function daysSince(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  return Math.max(Math.floor(diff / 86_400_000), 0);
}

export function MembersView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const router = useRouter();
  const [memberRows, setMemberRows] = useState<Member[]>(members);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<MemberStatus | "Tous">("Tous");
  const [functionFilter, setFunctionFilter] = useState("Toutes");
  const [categoryFilter, setCategoryFilter] = useState("Toutes");
  const [cityFilter, setCityFilter] = useState("Toutes");
  const [datePreset, setDatePreset] = useState("Tous");
  const [contributionFilter, setContributionFilter] = useState<ContributionStatus | "Toutes">("Toutes");
  const [sort, setSort] = useState("name");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [importNotice, setImportNotice] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [quickMember, setQuickMember] = useState<Member | null>(null);
  const [fullName, setFullName] = useState("");
  const [memberType, setMemberType] = useState("Membre du bureau");
  const [bureau, setBureau] = useState("");
  const [memberFunction, setMemberFunction] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [profession, setProfession] = useState("");
  const [joinedAt, setJoinedAt] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<MemberStatus>("Actif");
  const settingsQuery = useQuery({
    queryKey: ["workspace-settings", workspaceSlug],
    queryFn: () => getWorkspaceSettings(workspaceSlug),
    retry: false
  });
  const membersQuery = useQuery({
    queryKey: ["members", workspaceSlug],
    queryFn: () => listMembers(workspaceSlug),
    retry: false
  });
  const memberPreferences = settingsQuery.data?.member_preferences;
  const memberTypeOptions = useMemo(() => uniqueStrings(["Membre du bureau", ...stringPreference(memberPreferences, "categories", defaultMemberCategories)]), [memberPreferences]);
  const bureauOptions = useMemo(() => stringPreference(memberPreferences, "groups", defaultMemberGroups), [memberPreferences]);
  const memberFunctionOptions = useMemo(() => stringPreference(memberPreferences, "functions", defaultMemberFunctions), [memberPreferences]);
  const isBureauMember = memberType.toLowerCase().includes("bureau");

  useEffect(() => {
    if (membersQuery.data) {
      setMemberRows(membersQuery.data);
    }
  }, [membersQuery.data]);

  useEffect(() => {
    if (!memberTypeOptions.includes(memberType)) {
      setMemberType(memberTypeOptions[0] || "Membre du bureau");
    }
  }, [memberType, memberTypeOptions]);

  useEffect(() => {
    if (!bureau && bureauOptions[0]) {
      setBureau(bureauOptions[0]);
    }
  }, [bureau, bureauOptions]);

  useEffect(() => {
    if (!memberFunction && memberFunctionOptions[0]) {
      setMemberFunction(memberFunctionOptions[0]);
    }
  }, [memberFunction, memberFunctionOptions]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 350);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, statusFilter, functionFilter, categoryFilter, cityFilter, datePreset, contributionFilter, sort, pageSize]);

  const functions = useMemo(() => ["Toutes", ...Array.from(new Set([...memberFunctionOptions, ...memberRows.map((member) => member.function)])).filter(Boolean).sort()], [memberFunctionOptions, memberRows]);
  const categories = useMemo(() => ["Toutes", ...Array.from(new Set([...memberTypeOptions, ...memberRows.map((member) => member.category)])).filter(Boolean).sort()], [memberRows, memberTypeOptions]);
  const cities = useMemo(() => ["Toutes", ...Array.from(new Set(memberRows.map((member) => member.city))).sort()], [memberRows]);

  const summary = useMemo(() => {
    const active = memberRows.filter((member) => member.status === "Actif").length;
    const pending = memberRows.filter((member) => member.status === "En attente").length;
    const inactive = memberRows.filter((member) => member.status === "Inactif").length;
    const archived = memberRows.filter((member) => member.status === "Archive").length;
    const newMembers = memberRows.filter((member) => daysSince(member.joinedAt) <= 30).length;
    const paidMembers = memberRows.filter((member) => member.contribution === "A jour").length;
    return {
      total: memberRows.length,
      active,
      pending,
      inactive,
      archived,
      newMembers,
      growthRate: memberRows.length ? Math.round((newMembers / memberRows.length) * 1000) / 10 : 0,
      contributionRate: memberRows.length ? Math.round((paidMembers / memberRows.length) * 1000) / 10 : 0
    };
  }, [memberRows]);

  const segments = [
    { label: "Actifs", count: summary.active, apply: () => setStatusFilter("Actif") },
    { label: "Nouveaux", count: summary.newMembers, apply: () => setDatePreset("30 derniers jours") },
    { label: "Cotisations en retard", count: memberRows.filter((member) => member.contribution === "En retard").length, apply: () => setContributionFilter("En retard") },
    { label: "Bureau", count: memberRows.filter((member) => member.category.toLowerCase().includes("bureau")).length, apply: () => setCategoryFilter("Membre du bureau") }
  ];

  const visibleMembers = useMemo(() => {
    const normalizedQuery = debouncedQuery.trim().toLowerCase();
    return memberRows
      .filter((member) => {
        const haystack = `${member.name} ${member.email} ${member.phone} ${member.number} ${member.function} ${member.profession}`.toLowerCase();
        const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
        const matchesStatus = statusFilter === "Tous" || member.status === statusFilter;
        const matchesFunction = functionFilter === "Toutes" || member.function === functionFilter;
        const matchesCategory = categoryFilter === "Toutes" || member.category === categoryFilter;
        const matchesCity = cityFilter === "Toutes" || member.city === cityFilter;
        const matchesContribution = contributionFilter === "Toutes" || member.contribution === contributionFilter;
        const matchesDate =
          datePreset === "Tous" ||
          (datePreset === "Aujourd'hui" && daysSince(member.joinedAt) === 0) ||
          (datePreset === "Cette semaine" && daysSince(member.joinedAt) <= 7) ||
          (datePreset === "Ce mois" && daysSince(member.joinedAt) <= 31) ||
          (datePreset === "Cette annee" && new Date(member.joinedAt).getFullYear() === new Date().getFullYear()) ||
          (datePreset === "30 derniers jours" && daysSince(member.joinedAt) <= 30);
        return matchesQuery && matchesStatus && matchesFunction && matchesCategory && matchesCity && matchesContribution && matchesDate;
      })
      .sort((first, second) => {
        if (sort === "join_date") return new Date(second.joinedAt).getTime() - new Date(first.joinedAt).getTime();
        if (sort === "status") return first.status.localeCompare(second.status);
        if (sort === "last_activity") return first.lastActivity.localeCompare(second.lastActivity);
        return first.name.localeCompare(second.name);
      });
  }, [categoryFilter, cityFilter, contributionFilter, datePreset, debouncedQuery, functionFilter, memberRows, sort, statusFilter]);

  const totalPages = Math.max(Math.ceil(visibleMembers.length / pageSize), 1);
  const pagedMembers = visibleMembers.slice((page - 1) * pageSize, page * pageSize);

  function resetFilters() {
    setQuery("");
    setDebouncedQuery("");
    setStatusFilter("Tous");
    setFunctionFilter("Toutes");
    setCategoryFilter("Toutes");
    setCityFilter("Toutes");
    setDatePreset("Tous");
    setContributionFilter("Toutes");
    setSort("name");
  }

  async function addMember() {
    const cleanName = fullName.trim();
    const cleanFunction = memberFunction.trim();
    const cleanProfession = profession.trim();
    const cleanType = memberType.trim();
    const cleanBureau = bureau.trim();
    if (!cleanName || !cleanType || !cleanProfession || (isBureauMember && (!cleanBureau || !cleanFunction))) return;

    const { firstName, lastName } = splitName(cleanName);

    try {
      const created = await apiFetch<ApiMember>("/members/", {
        method: "POST",
        headers: { "X-Workspace": workspaceSlug },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email: email.trim(),
          phone: phone.trim(),
          function: isBureauMember ? cleanFunction : cleanType,
          occupation: cleanProfession,
          join_date: joinedAt,
          status: statusToApi[status],
          category_name: cleanType,
          group_names: isBureauMember ? [cleanBureau] : []
        })
      });

      setMemberRows((current) => [mapApiMember(created, current.length), ...current.filter((member) => member.id !== String(created.id))]);
      setFullName("");
      setMemberType("Membre du bureau");
      setBureau(bureauOptions[0] || "");
      setMemberFunction(memberFunctionOptions[0] || "");
      setPhone("");
      setEmail("");
      setProfession("");
      setJoinedAt(new Date().toISOString().slice(0, 10));
      setStatus("Actif");
      setImportNotice("Membre enregistre dans la base de donnees.");
      setShowForm(false);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Impossible d'enregistrer le membre.";
      setImportNotice(message);
    }
  }

  function changeStatus(memberId: string, nextStatus: MemberStatus) {
    setMemberRows((current) => current.map((member) => (member.id === memberId ? { ...member, status: nextStatus } : member)));
  }

  function archiveSelected() {
    const count = selectedIds.length;
    if (!count) return;
    const confirmed = window.confirm(`Archiver ${count} membre(s) selectionne(s) ?`);
    if (!confirmed) return;
    setMemberRows((current) => current.map((member) => (selectedIds.includes(member.id) ? { ...member, status: "Archive" } : member)));
    setSelectedIds([]);
  }

  function exportMembers() {
    const header = ["Numero", "Nom et prenoms", "Email", "Telephone", "Profession", "Fonction", "Categorie", "Ville", "Date adhesion", "Statut", "Cotisation", "Derniere activite"];
    const rows = visibleMembers.map((member) => [member.number, member.name, member.email, member.phone, member.profession, member.function, member.category, member.city, member.joinedAt, member.status, member.contribution, member.lastActivity]);
    const csvContent = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `novex-annuaire-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setImportNotice(`${visibleMembers.length} membre(s) exporte(s) avec les filtres actifs.`);
  }

  function importMembers(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || "");
      const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const dataLines = lines[0]?.toLowerCase().includes("nom") ? lines.slice(1) : lines;
      const importedMembers = dataLines
        .map((line, index) => {
          const [name, emailAddress, phoneNumber, role, date, importedStatus] = parseCsvLine(line);
          const cleanName = name?.trim();
          const cleanRole = role?.trim() || "Membre";
          if (!cleanName) return null;
          const nextStatus = ["Actif", "En attente", "Inactif", "Suspendu", "Archive"].includes(importedStatus) ? importedStatus as MemberStatus : "Actif";
          return {
            id: `${Date.now()}-${index}`,
            number: `NVX-IMP-${String(index + 1).padStart(3, "0")}`,
            name: cleanName,
            email: emailAddress?.trim() || `${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "membre"}@example.com`,
            phone: phoneNumber?.trim() || "",
            function: cleanRole,
            profession: "",
            category: "Membres",
            city: "Abidjan",
            gender: "Non precise",
            joinedAt: date?.trim() || new Date().toISOString().slice(0, 10),
            status: nextStatus,
            contribution: "Aucune cotisation" as ContributionStatus,
            lastActivity: "Import CSV",
            avatar: avatarStyles[index % avatarStyles.length]
          };
        })
        .filter((member): member is Member => Boolean(member));

      if (!importedMembers.length) {
        setImportNotice("Aucun membre valide trouve dans le fichier.");
        event.target.value = "";
        return;
      }

      setMemberRows((current) => [...importedMembers, ...current]);
      setImportNotice(`${importedMembers.length} membre(s) importe(s). Preview: ${importedMembers.length} valides, 0 erreur.`);
      event.target.value = "";
    };
    reader.readAsText(file);
  }

  function toggleSelected(memberId: string) {
    setSelectedIds((current) => (current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]));
  }

  const filterControls = (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="grid gap-1 text-xs font-black text-slate-600">
          Statut
          <select className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as MemberStatus | "Tous")}>
            {["Tous", "Actif", "En attente", "Inactif", "Suspendu", "Archive"].map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600">
          Fonction
          <select className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none" value={functionFilter} onChange={(event) => setFunctionFilter(event.target.value)}>
            {functions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600">
          Categorie
          <select className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            {categories.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600">
          Ville
          <select className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none" value={cityFilter} onChange={(event) => setCityFilter(event.target.value)}>
            {cities.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="grid gap-1 text-xs font-black text-slate-600">
          Adhesion
          <select className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none" value={datePreset} onChange={(event) => setDatePreset(event.target.value)}>
            {["Tous", "Aujourd'hui", "Cette semaine", "Ce mois", "Cette annee", "30 derniers jours"].map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600">
          Cotisation
          <select className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none" value={contributionFilter} onChange={(event) => setContributionFilter(event.target.value as ContributionStatus | "Toutes")}>
            {["Toutes", "A jour", "En retard", "Partiel", "Aucune cotisation"].map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600">
          Trier par
          <select className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="name">Nom</option>
            <option value="join_date">Date d'adhesion</option>
            <option value="status">Statut</option>
            <option value="last_activity">Derniere activite</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600">
          Page
          <select className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            {pageSizeOptions.map((option) => <option key={option} value={option}>{option} lignes</option>)}
          </select>
        </label>
      </div>
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs font-bold text-slate-600">
        Filtres avances prepares: Champ + Operateur + Valeur. Exemple actif: Cotisation = {contributionFilter}.
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#f5f7f8] px-4 pb-28 pt-4 text-slate-950 md:rounded-[28px] md:px-6">
      <button className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-white px-3 text-sm font-black text-slate-700 shadow-sm" type="button" onClick={() => router.back()}>
        <ArrowLeft className="size-4" />
        Retour
      </button>

      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img className="h-10 w-32 object-contain object-left" src="/brand/novex-logo.jpg" alt="NOVEX" />
        </div>
        <button className="grid size-10 place-items-center rounded-full bg-white shadow-sm" type="button" aria-label="Notifications">
          <Bell className="size-5" />
        </button>
      </header>

      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black leading-tight tracking-normal">Membres</h1>
          <p className="mt-2 text-sm font-medium leading-5 text-slate-600">Annuaire de votre association.</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button className="min-h-11 px-3" type="button" onClick={() => setShowForm(true)}>
            <Plus className="size-4" />
            Ajouter
          </Button>
          <Button asChild className="min-h-11 px-3" variant="outline">
            <Link href={workspacePath(workspaceSlug, "members/invitations")}>
              <UserPlus className="size-4" />
              Inviter
            </Link>
          </Button>
          <Button className="min-h-11 px-3" type="button" variant="outline" onClick={exportMembers}>
            <Download className="size-4" />
            Exporter
          </Button>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
        {[
          ["Total membres", summary.total.toLocaleString("fr-FR"), Users, "text-slate-950"],
          ["Membres actifs", summary.active.toLocaleString("fr-FR"), Users, "text-emerald-600"],
          ["En attente", summary.pending.toLocaleString("fr-FR"), UserPlus, "text-blue-700"],
          ["Nouveaux", `+${summary.newMembers}`, TrendingUp, "text-blue-700"],
          ["Inactifs", summary.inactive.toLocaleString("fr-FR"), Users, "text-slate-600"],
          ["Archives", summary.archived.toLocaleString("fr-FR"), Archive, "text-red-600"]
        ].map(([label, value, Icon, color]) => (
          <div className="min-h-28 rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={label as string}>
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold text-slate-600">{label as string}</span>
              <Icon className="size-7 text-slate-200" />
            </div>
            <div className={`mt-3 text-3xl font-black tracking-normal ${color as string}`}>{value as string}</div>
          </div>
        ))}
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black text-slate-500">Taux de croissance</p>
          <p className="mt-2 text-2xl font-black text-slate-950">+{summary.growthRate}%</p>
          {summary.total ? (
            <div className="mt-3 flex h-10 items-end gap-1" aria-label="Croissance des membres">
              {[summary.newMembers, summary.active, summary.total].map((height, index) => <span className="w-full rounded-t bg-blue-600" style={{ height: `${Math.max(8, Math.min(100, height * 10))}%` }} key={index} />)}
            </div>
          ) : <p className="mt-3 text-xs font-bold text-slate-500">Aucune evolution a afficher.</p>}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black text-slate-500">Taux de cotisation</p>
          <p className="mt-2 text-2xl font-black text-emerald-600">{summary.contributionRate}%</p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
            <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${summary.contributionRate}%` }} />
          </div>
        </div>
      </section>

      <label className="mt-5 flex min-h-12 items-center gap-3 rounded-md border border-slate-300 bg-white px-4 shadow-sm">
        <Search className="size-5 text-slate-500" />
        <input className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-slate-500" placeholder="Rechercher nom, email, telephone, numero..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>

      <div className="mt-4 grid grid-cols-2 gap-3 md:hidden">
        <Button className="min-h-10 px-4" type="button" variant="outline" onClick={() => setShowFilters(true)}>
          <Filter className="size-4" />
          Filtrer
        </Button>
        <Button className="min-h-10 px-4" type="button" variant="outline" onClick={resetFilters}>
          <RotateCcw className="size-4" />
          Reinitialiser
        </Button>
      </div>

      <section className="mt-4 hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:block">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-black">Recherche et filtres</h2>
          <Button className="min-h-9 px-3 text-xs" type="button" variant="outline" onClick={resetFilters}>
            <RotateCcw className="size-4" />
            Reinitialiser
          </Button>
        </div>
        {filterControls}
      </section>

      <section className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {segments.map((segment) => (
          <button className="min-w-fit rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm" type="button" key={segment.label} onClick={segment.apply}>
            {segment.label} <span className="text-blue-700">{segment.count}</span>
          </button>
        ))}
      </section>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-bold shadow-sm transition-colors hover:bg-slate-50">
          <Upload className="size-4" />
          Importer
          <input className="sr-only" type="file" accept=".csv,text/csv" onChange={importMembers} />
        </label>
        <Button className="min-h-11 px-4" type="button" variant="outline" onClick={exportMembers}>
          <Download className="size-4" />
          Exporter {visibleMembers.length}
        </Button>
        <Button asChild className="min-h-11 px-4" variant="outline">
          <Link href={`/app/${workspaceSlug}/members/applications`}>
            <UserPlus className="size-4" />
            Demandes
          </Link>
        </Button>
        <Button asChild className="min-h-11 px-4" variant="outline">
          <Link href={`/app/${workspaceSlug}/communication`}>
            <Mail className="size-4" />
            Notifier
          </Link>
        </Button>
      </div>

      {selectedIds.length ? (
        <section className="sticky top-3 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-slate-950 p-3 text-white shadow-xl">
          <CheckSquare className="size-5" />
          <strong className="mr-auto text-sm">{selectedIds.length} selectionne(s)</strong>
          <Button className="min-h-9 px-3 text-xs" type="button" variant="outline" onClick={exportMembers}>Exporter</Button>
          <Button className="min-h-9 px-3 text-xs" type="button" variant="outline" onClick={archiveSelected}>Archiver</Button>
        </section>
      ) : null}

      {importNotice ? <p className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">{importNotice}</p> : null}
      {membersQuery.isLoading ? <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">Chargement des membres...</p> : null}
      {membersQuery.isError ? <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">Impossible de charger les membres pour le moment. Vous pouvez reessayer apres avoir verifie le backend.</p> : null}

      <section className="mt-5 grid gap-3 md:hidden">
        {pagedMembers.map((member) => (
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={member.id}>
            <div className="flex items-start gap-4">
              <input className="mt-4 size-4" type="checkbox" checked={selectedIds.includes(member.id)} onChange={() => toggleSelected(member.id)} aria-label={`Selectionner ${member.name}`} />
              <button className={`grid size-12 shrink-0 place-items-center rounded-full ${member.avatar}`} type="button" onClick={() => setQuickMember(member)}>
                <span className="text-sm font-black text-white">{member.name.slice(0, 1)}</span>
              </button>
              <div className="min-w-0 flex-1">
                <button className="block max-w-full truncate text-left text-base font-black tracking-normal" type="button" onClick={() => setQuickMember(member)}>{member.name}</button>
                <p className="text-xs font-bold text-slate-500">{member.number}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black ${statusClass(member.status)}`}>{member.status}</span>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black ${contributionClass(member.contribution)}`}>Cotisation: {member.contribution}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">{member.function}</span>
                  {member.profession ? <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-700">{member.profession}</span> : null}
                </div>
              </div>
              <button className="grid size-9 place-items-center rounded-full bg-slate-100" type="button" aria-label="Actions" onClick={() => setQuickMember(member)}>
                <MoreVertical className="size-4" />
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-blue-700">
              {member.phone ? <a href={`tel:${member.phone.replace(/\s/g, "")}`}><Phone className="mr-1 inline size-3" />Appeler</a> : null}
              {member.email ? <a href={`mailto:${member.email}`}><Mail className="mr-1 inline size-3" />Email</a> : null}
              <button type="button" onClick={() => setQuickMember(member)}>Profil rapide</button>
              <Link href={`/app/${workspaceSlug}/members/${member.id}`}>Voir le profil</Link>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-6 hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <div className="grid grid-cols-[44px_minmax(220px,1.5fr)_120px_1fr_150px_120px_150px_150px_110px] gap-3 border-b border-slate-200 px-4 py-3 text-xs font-black uppercase text-slate-500">
          <span />
          <span>Membre</span>
          <span>Numero</span>
          <span>Fonction</span>
          <span>Contact</span>
          <span>Statut</span>
          <span>Cotisation</span>
          <span>Derniere activite</span>
          <span>Actions</span>
        </div>
        {pagedMembers.map((member) => (
          <div className="grid grid-cols-[44px_minmax(220px,1.5fr)_120px_1fr_150px_120px_150px_150px_110px] items-center gap-3 border-b border-slate-100 px-4 py-4 text-sm last:border-b-0" key={`table-${member.id}`}>
            <input className="size-4" type="checkbox" checked={selectedIds.includes(member.id)} onChange={() => toggleSelected(member.id)} aria-label={`Selectionner ${member.name}`} />
            <div className="flex min-w-0 items-center gap-3">
              <div className={`grid size-10 shrink-0 place-items-center rounded-full ${member.avatar}`}>
                <span className="text-xs font-black text-white">{member.name.slice(0, 1)}</span>
              </div>
              <div className="min-w-0">
                <Link className="block truncate font-black hover:text-blue-700" href={`/app/${workspaceSlug}/members/${member.id}`}>{member.name}</Link>
                <span className="block truncate text-xs text-slate-500">{member.category}{member.profession ? ` - ${member.profession}` : ""}</span>
              </div>
            </div>
            <span className="font-bold text-slate-600">{member.number}</span>
            <span className="font-semibold">{member.function}</span>
            <span className="min-w-0 text-xs font-semibold text-slate-600">
              <a className="block truncate text-blue-700" href={`tel:${member.phone.replace(/\s/g, "")}`}>{member.phone}</a>
              <a className="block truncate" href={`mailto:${member.email}`}>{member.email}</a>
            </span>
            <span className={`w-fit rounded-full px-2 py-1 text-[11px] font-black ${statusClass(member.status)}`}>{member.status}</span>
            <span className={`w-fit rounded-full px-2 py-1 text-[11px] font-black ${contributionClass(member.contribution)}`}>{member.contribution}</span>
            <span className="font-semibold text-slate-600">{member.lastActivity}</span>
            <div className="flex gap-2">
              <Button className="min-h-8 px-2 text-xs" type="button" variant="outline" onClick={() => setQuickMember(member)}>Voir</Button>
              <Button className="min-h-8 px-2 text-xs" type="button" variant="outline" onClick={() => changeStatus(member.id, member.status === "Archive" ? "Actif" : "Archive")}>
                {member.status === "Archive" ? "Restaurer" : "Archiver"}
              </Button>
            </div>
          </div>
        ))}
      </section>

      {!visibleMembers.length ? (
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h2 className="text-xl font-black">{debouncedQuery ? `Aucun resultat pour "${debouncedQuery}"` : "Aucun membre trouve."}</h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">Essayez de modifier vos filtres ou ajoutez un nouveau membre.</p>
          <Button className="mt-4 min-h-10 px-4" type="button" onClick={resetFilters}>Effacer la recherche</Button>
        </section>
      ) : null}

      <section className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-sm font-bold shadow-sm">
        <span>{visibleMembers.length} resultat(s)</span>
        <div className="flex items-center gap-2">
          <button className="grid size-9 place-items-center rounded-md border border-slate-200 disabled:opacity-40" type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(value - 1, 1))} aria-label="Page precedente">
            <ChevronLeft className="size-4" />
          </button>
          <span>Page {page}/{totalPages}</span>
          <button className="grid size-9 place-items-center rounded-md border border-slate-200 disabled:opacity-40" type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(value + 1, totalPages))} aria-label="Page suivante">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </section>

      {showFilters ? (
        <section className="fixed inset-0 z-40 grid place-items-end bg-slate-950/35 px-4 pb-4 md:hidden">
          <div className="w-full rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-black">Filtres avances</h2>
              <button className="grid size-9 place-items-center rounded-full bg-slate-100" type="button" aria-label="Fermer" onClick={() => setShowFilters(false)}>
                <X className="size-5" />
              </button>
            </div>
            {filterControls}
            <Button className="mt-5 min-h-12 w-full" type="button" onClick={() => setShowFilters(false)}>Appliquer</Button>
          </div>
        </section>
      ) : null}

      {quickMember ? (
        <section className="fixed inset-0 z-40 grid place-items-end bg-slate-950/35 px-4 pb-4 md:place-items-center">
          <aside className="w-full rounded-2xl bg-white p-5 shadow-2xl md:max-w-md">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-black tracking-normal">Profil rapide</h2>
              <button className="grid size-9 place-items-center rounded-full bg-slate-100" type="button" aria-label="Fermer" onClick={() => setQuickMember(null)}>
                <X className="size-5" />
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className={`grid size-16 place-items-center rounded-full ${quickMember.avatar}`}>
                <span className="text-xl font-black text-white">{quickMember.name.slice(0, 1)}</span>
              </div>
              <div>
                <h3 className="text-xl font-black">{quickMember.name}</h3>
                <p className="text-sm font-bold text-slate-500">{quickMember.function} - {quickMember.number}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 text-sm font-semibold text-slate-700">
              <p><span className="font-black text-slate-950">Statut:</span> {quickMember.status}</p>
              <p><span className="font-black text-slate-950">Telephone:</span> {quickMember.phone || "Non renseigne"}</p>
              <p><span className="font-black text-slate-950">Email:</span> {quickMember.email || "Non renseigne"}</p>
              <p><span className="font-black text-slate-950">Profession:</span> {quickMember.profession || "Non renseignee"}</p>
              <p><span className="font-black text-slate-950">Cotisation:</span> {quickMember.contribution}</p>
              <p><span className="font-black text-slate-950">Derniere activite:</span> {quickMember.lastActivity}</p>
              <p><span className="font-black text-slate-950">Adhesion:</span> {formatDate(quickMember.joinedAt)}</p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button asChild className="min-h-11">
                <Link href={`/app/${workspaceSlug}/members/${quickMember.id}`}>Voir le profil</Link>
              </Button>
              <Button className="min-h-11" type="button" variant="outline" onClick={() => changeStatus(quickMember.id, quickMember.status === "Archive" ? "Actif" : "Archive")}>
                {quickMember.status === "Archive" ? "Restaurer" : "Archiver"}
              </Button>
            </div>
          </aside>
        </section>
      ) : null}

      {showForm ? (
        <section className="fixed inset-0 z-40 grid place-items-end bg-slate-950/35 px-4 pb-24 md:absolute md:place-items-center md:pb-0">
          <form className="w-full rounded-2xl bg-white p-5 shadow-2xl md:max-w-md" onSubmit={(event) => { event.preventDefault(); addMember(); }}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-black tracking-normal">Ajouter un membre</h2>
              <button className="grid size-9 place-items-center rounded-full bg-slate-100" type="button" aria-label="Fermer" onClick={() => setShowForm(false)}>
                <X className="size-5" />
              </button>
            </div>
            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-bold">
                Nom et prenoms
                <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" placeholder="Ex: Mariam Kone" value={fullName} onChange={(event) => setFullName(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Type de membre
                <select className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base outline-none" value={memberType} onChange={(event) => setMemberType(event.target.value)}>
                  {memberTypeOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
              {isBureauMember ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold">
                    Bureau
                    <select className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base outline-none" value={bureau} onChange={(event) => setBureau(event.target.value)}>
                      {bureauOptions.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-bold">
                    Fonction
                    <select className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base outline-none" value={memberFunction} onChange={(event) => setMemberFunction(event.target.value)}>
                      {memberFunctionOptions.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </label>
                </div>
              ) : null}
              <label className="grid gap-2 text-sm font-bold">
                Numero
                <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" placeholder="+225 07 00 00 00 00" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Email
                <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" placeholder="membre@example.com" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Profession
                <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" placeholder="Ex: Comptable" value={profession} onChange={(event) => setProfession(event.target.value)} required />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-sm font-bold">
                  Adhesion
                  <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" type="date" value={joinedAt} onChange={(event) => setJoinedAt(event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Statut
                  <select className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base outline-none" value={status} onChange={(event) => setStatus(event.target.value as MemberStatus)}>
                    {["Actif", "En attente", "Inactif", "Suspendu", "Archive"].map((option) => <option key={option}>{option}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <Button className="mt-6 min-h-12 w-full bg-blue-700 text-white hover:bg-blue-800" disabled={!fullName.trim() || !memberType.trim() || !profession.trim() || (isBureauMember && (!bureau.trim() || !memberFunction.trim()))} type="submit">
              Enregistrer le membre
            </Button>
          </form>
        </section>
      ) : null}

      <button className="fixed bottom-24 right-5 z-20 grid size-14 place-items-center rounded-full bg-blue-700 text-white shadow-xl shadow-blue-900/25 md:hidden" type="button" aria-label="Ajouter un membre" onClick={() => setShowForm(true)}>
        <Plus className="size-7" />
      </button>

      <section className="mt-6 rounded-xl bg-[#0f2347] p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-full bg-white/15">
            <Bot className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-black">Assistant IA</h2>
            <p className="text-xs font-medium text-white/75">Analysez les segments et l'engagement des membres.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
