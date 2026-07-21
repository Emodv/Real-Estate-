import * as React from "react";

type Tone = "good" | "warn" | "bad" | "muted" | "accent";

const toneClasses: Record<Tone, string> = {
  good: "bg-good/15 text-good border-good/30",
  warn: "bg-warn/15 text-warn border-warn/30",
  bad: "bg-bad/15 text-bad border-bad/30",
  muted: "bg-surface2 text-muted border-border",
  accent: "bg-accent/15 text-accent border-accent/30",
};

export function Badge({
  children,
  tone = "muted",
  className = "",
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-5 ${className}`}>{children}</div>
  );
}

export function Section({
  title,
  subtitle,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </Card>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: Tone;
}) {
  const color = tone ? toneClasses[tone].split(" ")[1] : "text-text";
  return (
    <div className="rounded-lg border border-border bg-surface2 px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-xl font-semibold tnum ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Meter({ value, max = 100 }: { value: number; max?: number }) {
  const clamped = Math.max(0, Math.min(value, max));
  const pct = (clamped / max) * 100;
  const tone = pct >= 70 ? "bg-good" : pct >= 45 ? "bg-warn" : "bg-bad";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface2">
      <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Row({
  label,
  value,
  strong,
  note,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
  note?: string;
  tone?: "good" | "warn" | "bad";
}) {
  const color = tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "";
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/50 py-1.5 last:border-0">
      <span className={`text-sm ${strong ? "font-semibold text-text" : "text-muted"}`}>
        {label}
        {note && <span className="ml-2 text-xs text-muted/70">{note}</span>}
      </span>
      <span className={`tnum text-sm ${strong ? "font-semibold" : ""} ${color}`}>{value}</span>
    </div>
  );
}
