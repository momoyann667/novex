import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  title,
  value,
  detail,
  trend,
  icon,
}: Readonly<{ title: string; value: string | number | null; detail?: string; trend?: "up" | "down" | "neutral"; icon?: ReactNode }>) {
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;

  return (
    <Card className="min-h-40 overflow-hidden">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        {icon ? <div className="rounded-md border border-border bg-slate-50 p-2 text-blue-700">{icon}</div> : null}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tabular-nums tracking-normal">{value ?? "Masque"}</div>
        {detail ? (
          <div className={cn("mt-3 flex items-center gap-1 text-sm", trend === "up" && "text-emerald-700", trend === "down" && "text-red-700", !trend && "text-slate-500")}>
            {trend ? <TrendIcon className="size-4" /> : null}
            {detail}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
