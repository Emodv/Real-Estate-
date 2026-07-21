"use client";

import * as React from "react";
import type { MathLine } from "@/lib/underwriting";
import { money } from "@/lib/format";

/**
 * "Show Your Math" — a toggleable, line-by-line breakdown. Collapsed by
 * default to a summary; expand to see every add/subtract that produces the
 * ceiling. Purely presentational; the numbers come from the deterministic
 * engine.
 */
export function ShowMath({ lines }: { lines: MathLine[] }) {
  const [open, setOpen] = React.useState(true);
  const result = lines.find((l) => l.op === "result");

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-md border border-border bg-surface2 px-3 py-1.5 text-xs font-medium hover:bg-border"
        >
          {open ? "Hide math" : "Show math"}
        </button>
        {result && (
          <span className="tnum text-sm font-semibold">
            {result.label}: {money(result.amount)}
          </span>
        )}
      </div>
      {open && (
        <div className="rounded-lg border border-border bg-surface2">
          {lines.map((l, i) => {
            if (l.op === "result") {
              return (
                <div
                  key={i}
                  className="flex items-center justify-between border-t-2 border-border px-4 py-2.5 font-semibold"
                >
                  <span>{l.label}</span>
                  <span className="tnum">{money(l.amount)}</span>
                </div>
              );
            }
            return (
              <div
                key={i}
                className="flex items-center justify-between border-b border-border/40 px-4 py-2 text-sm"
              >
                <span className={l.op === "info" ? "font-medium" : "text-muted"}>
                  {l.label}
                  {l.note && <span className="ml-2 text-xs text-muted/70">{l.note}</span>}
                </span>
                <span
                  className={`tnum ${l.op === "subtract" ? "text-bad" : l.op === "add" ? "text-good" : ""}`}
                >
                  {money(l.amount)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
