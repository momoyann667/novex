import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions
}: Readonly<{ title: string; description?: string; actions?: ReactNode }>) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-normal">{title}</h1>
        {description ? <p className="mt-1 text-slate-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </header>
  );
}
