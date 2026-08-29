export function ProgressRing({ value, label }: Readonly<{ value: number; label: string }>) {
  const bounded = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-5">
      <div
        className="grid size-28 place-items-center rounded-full"
        style={{ background: `conic-gradient(#0b4ed8 ${bounded * 3.6}deg, #e5eaf1 0deg)` }}
        role="img"
        aria-label={`${label}: ${bounded}%`}
      >
        <div className="grid size-20 place-items-center rounded-full bg-white text-xl font-bold">{bounded}%</div>
      </div>
      <div>
        <div className="font-semibold">{label}</div>
        <p className="text-sm text-slate-500">Calcul serveur, affiche selon permissions.</p>
      </div>
    </div>
  );
}
