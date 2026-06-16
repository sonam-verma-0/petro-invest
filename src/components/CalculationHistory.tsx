import { useEffect, useState } from "react";
import { Download, Eye, Trash2, History as HistoryIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  loadHistory,
  deleteHistoryRecord,
} from "@/lib/history";
import { generatePdf, formatTs, unitSuffix, type CalcRecord } from "@/lib/report";

function fmtRupeeForUnit(v: number | null | undefined, unit: CalcRecord["unit"]) {
  if (v == null || !isFinite(v)) return "—";
  const mult = unit === "cr" ? 1e7 : unit === "lakh" ? 1e5 : 1;
  const scaled = v / mult;
  const suffix = unit === "cr" ? " Cr" : unit === "lakh" ? " L" : "";
  return `₹${scaled.toLocaleString("en-IN", { maximumFractionDigits: 2 })}${suffix}`;
}

function verdictClasses(v: CalcRecord["results"]["verdict"]) {
  if (v === "INVEST") return "bg-success/10 text-success border-success/30";
  if (v === "REJECT") return "bg-destructive/10 text-destructive border-destructive/30";
  return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30";
}

function verdictLabel(v: CalcRecord["results"]["verdict"]) {
  return v === "INVEST" ? "Accept" : v === "REJECT" ? "Reject" : "Analyze Further";
}

export function CalculationHistory({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<CalcRecord[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setItems(loadHistory());
  }, [refreshKey]);

  if (items.length === 0) {
    return (
      <section className="mt-8 rounded-2xl border border-primary/10 bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <span className="h-6 w-1 rounded-full bg-gradient-to-b from-accent to-primary" />
          <h2 className="font-display text-xl font-semibold tracking-tight text-primary">
            Calculation History
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center py-6 text-center text-sm text-muted-foreground">
          <HistoryIcon className="size-8 mb-2 opacity-60" />
          No calculations yet. Hit{" "}
          <span className="font-medium text-foreground">&nbsp;Calculate&nbsp;</span> to
          save your first record.
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-primary/10 bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-6 w-1 rounded-full bg-gradient-to-b from-accent to-primary" />
        <h2 className="font-display text-xl font-semibold tracking-tight text-primary">
          Calculation History
        </h2>
        <span className="ml-auto text-xs text-muted-foreground">
          {items.length} record{items.length > 1 ? "s" : ""} · stored on this device
        </span>
      </div>

      <ul className="space-y-3">
        {items.map((r) => {
          const isOpen = expanded === r.id;
          return (
            <li
              key={r.id}
              className="rounded-xl border border-primary/10 bg-background/40 transition hover:border-primary/25"
            >
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground truncate">
                      {r.projectName}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${verdictClasses(
                        r.results.verdict,
                      )}`}
                    >
                      {verdictLabel(r.results.verdict)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Date: {formatTs(r.timestamp)}</span>
                    <span>
                      NPV:{" "}
                      <span className="font-mono text-foreground">
                        {fmtRupeeForUnit(r.results.npv, r.unit)}
                      </span>
                    </span>
                    <span>
                      MIRR:{" "}
                      <span className="font-mono text-foreground">
                        {r.results.mirr == null
                          ? "—"
                          : `${(r.results.mirr * 100).toFixed(2)}%`}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => generatePdf(r)}
                  >
                    <Download className="size-3.5" />
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                  >
                    <Eye className="size-3.5" />
                    {isOpen ? "Hide" : "View"}
                    <ChevronDown
                      className={`size-3.5 transition ${isOpen ? "rotate-180" : ""}`}
                    />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => setItems(deleteHistoryRecord(r.id))}
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </Button>
                </div>
              </div>

              {isOpen && <RecordDetails record={r} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RecordDetails({ record: r }: { record: CalcRecord }) {
  const u = unitSuffix(r.unit);
  const i = r.inputs;
  return (
    <div className="border-t border-primary/10 px-4 py-4 grid gap-4 md:grid-cols-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Inputs
        </h3>
        <dl className="text-xs space-y-1">
          <Stat k="Type" v={r.projectType === "new" ? "New" : "Existing"} />
          <Stat k="Horizon" v={`${r.years} yrs`} />
          <Stat k="Capex" v={`${i.capex} ${u}`} />
          {i.salesMode === "constant" && (
            <>
              <Stat k="Sales/yr" v={`${i.annualSales} ${u}`} />
              <Stat k="NFR/yr" v={`${i.annualNfr} ${u}`} />
              <Stat k="Rev Exp/yr" v={`${i.annualRevenueExp} ${u}`} />
              <Stat k="Depr/yr" v={`${i.annualDepreciation} ${u}`} />
              <Stat k="Tax Rate" v={`${i.annualTaxRatePct}%`} />
            </>
          )}
          {i.salesMode === "yearwise" && (
            <Stat k="Sales Mode" v="Year-wise" />
          )}
          <Stat k="WACC" v={`${i.waccPct}%`} />
          <Stat k="Hurdle" v={`${i.hurdleRatePct}%`} />
        </dl>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Output Metrics
        </h3>
        <dl className="text-xs space-y-1">
          <Stat k="NPV" v={fmtRupeeForUnit(r.results.npv, r.unit)} />
          <Stat
            k="IRR"
            v={r.results.irr == null ? "—" : `${(r.results.irr * 100).toFixed(2)}%`}
          />
          <Stat
            k="MIRR"
            v={r.results.mirr == null ? "—" : `${(r.results.mirr * 100).toFixed(2)}%`}
          />
          <Stat
            k="Payback"
            v={r.results.payback == null ? "Not recovered" : `${r.results.payback.toFixed(2)} yrs`}
          />
          <Stat
            k="Disc. Payback"
            v={
              r.results.discountedPayback == null
                ? "Not recovered"
                : `${r.results.discountedPayback.toFixed(2)} yrs`
            }
          />
          <Stat
            k="PI"
            v={
              r.results.profitabilityIndex == null
                ? "—"
                : r.results.profitabilityIndex.toFixed(3)
            }
          />
          <Stat k="Verdict" v={verdictLabel(r.results.verdict)} />
        </dl>
      </div>

      <div className="md:col-span-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Cash Flow Summary
        </h3>
        <div className="max-h-56 overflow-y-auto rounded-md border border-primary/10">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/60">
              <tr>
                <th className="px-2 py-1 text-left">Year</th>
                <th className="px-2 py-1 text-right">Net CF</th>
                <th className="px-2 py-1 text-right">Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {r.cashflow.map((d, idx) => (
                <tr key={idx} className="border-t border-primary/5">
                  <td className="px-2 py-1 font-medium">{d.year}</td>
                  <td
                    className={`px-2 py-1 text-right font-mono ${
                      d.cashFlow < 0 ? "text-destructive" : "text-success"
                    }`}
                  >
                    {fmtRupeeForUnit(d.cashFlow, r.unit)}
                  </td>
                  <td
                    className={`px-2 py-1 text-right font-mono ${
                      d.cumulative < 0 ? "text-destructive" : "text-foreground"
                    }`}
                  >
                    {fmtRupeeForUnit(d.cumulative, r.unit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-primary/5 py-0.5 last:border-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-mono text-foreground">{v}</dd>
    </div>
  );
}
