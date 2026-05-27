import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { mirr, npv, irr, paybackPeriod, formatINR } from "@/lib/finance";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
      meta: [
      { title: "PETRO INVEST — MIRR for Indian Oil Projects" },
      { name: "description", content: "Evaluate Retail Outlet (RO) projects with MIRR, IRR, NPV and payback." },
    ],
  }),
  component: Index,
});

function Index() {
  const [ci, setCi] = useState<number | "">("");
  const [co, setCo] = useState<number | "">("");
  const [capex, setCapex] = useState<number | "">("");
  const [roType, setRoType] = useState<"existing" | "new">("new");
  const [years, setYears] = useState<number | "">(5);
  const wacc = 0.097;
  const [hurdleRatePct, setHurdleRatePct] = useState<number | "">(12);

  const [annualSales, setAnnualSales] = useState<number | "">("");
  const [annualNfr, setAnnualNfr] = useState<number | "">("");
  const [annualRevenueExp, setAnnualRevenueExp] = useState<number | "">("");
  const [annualTaxBenefit, setAnnualTaxBenefit] = useState<number | "">("");

  const [showResults, setShowResults] = useState(false);

  const n = (v: number | "") => (v === "" ? 0 : v);
  const hurdleRate = n(hurdleRatePct) / 100;
  const yearsN = Math.max(0, Math.floor(n(years)));

  const cashFlows = useMemo(() => {
    const flows: number[] = [];
    // Year 0: initial investment only — negative outflow
    flows.push(-(n(co) + n(capex)));
    // Years 1..yearsN: annual operating cash flow only
    const annualNet =
      n(annualSales) + n(annualNfr) + n(annualTaxBenefit) - n(annualRevenueExp);
    for (let i = 1; i <= yearsN; i++) flows.push(annualNet);
    return flows;
  }, [yearsN, co, capex, annualSales, annualNfr, annualRevenueExp, annualTaxBenefit]);

  const hasNegative = cashFlows.some((v) => v < 0);
  const hasPositive = cashFlows.some((v) => v > 0);

  const mirrValue = useMemo(() => mirr(cashFlows, wacc, wacc), [cashFlows]);
  const irrValue = useMemo(() => irr(cashFlows), [cashFlows]);
  const npvValue = useMemo(() => npv(hurdleRate, cashFlows), [cashFlows, hurdleRate]);
  const payback = useMemo(() => paybackPeriod(cashFlows), [cashFlows]);

  const decision = mirrValue == null
    ? null
    : mirrValue > hurdleRate
    ? { label: "Invest", tone: "success" as const, reason: `MIRR ${(mirrValue * 100).toFixed(2)}% exceeds hurdle rate ${(hurdleRate * 100).toFixed(2)}%.` }
    : { label: "Do Not Invest", tone: "destructive" as const, reason: `MIRR ${(mirrValue * 100).toFixed(2)}% is below hurdle rate ${(hurdleRate * 100).toFixed(2)}%.` };

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-10 flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <span className="size-1.5 rounded-full bg-accent" /> Capital Budgeting · Retail Outlet
          </div>
          <h1 className="mt-3 text-4xl font-semibold text-foreground md:text-5xl">PETRO INVEST</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Decide whether to invest in a new or existing retail outlet project using MIRR, IRR, NPV and payback.
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4 text-sm">
          <div className="text-muted-foreground">WACC (fixed)</div>
          <div className="font-display text-2xl font-semibold">{(wacc * 100).toFixed(1)}%</div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Project setup</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Cumulative Cash Inflow (CI) ₹"><NumInput value={ci} onChange={setCi} /></Field>
              <Field label="Cumulative Cash Outflow (CO) ₹"><NumInput value={co} onChange={setCo} /></Field>
              <Field label="One-time Capex ₹"><NumInput value={capex} onChange={setCapex} /></Field>
              <Field label="RO Type">
                <div className="flex gap-2">
                  {(["new", "existing"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setRoType(t)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ${
                        roType === t ? "border-accent bg-accent text-accent-foreground" : "bg-background hover:bg-muted"
                      }`}
                    >
                      {t} RO
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Number of years (0 = Year 0 only)">
                <NumInput value={years} onChange={setYears} min={0} max={30} />
              </Field>
              <Field label="Hurdle Rate %">
                <NumInput value={hurdleRatePct} onChange={setHurdleRatePct} min={0} max={100} step="0.1" />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Annual operating cash flows</h2>
              <span className="text-xs text-muted-foreground">These repeat every year</span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Project Sales (annual) ₹"><NumInput value={annualSales} onChange={setAnnualSales} /></Field>
              <Field label="NFR Income (annual) ₹"><NumInput value={annualNfr} onChange={setAnnualNfr} /></Field>
              <Field label="Revenue Expenses (annual) ₹"><NumInput value={annualRevenueExp} onChange={setAnnualRevenueExp} /></Field>
              <Field label="Income Tax Benefit (annual) ₹"><NumInput value={annualTaxBenefit} onChange={setAnnualTaxBenefit} /></Field>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Year-by-year breakdown</h2>
              <span className="text-xs text-muted-foreground">Auto-generated from annual values</span>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[500px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Year</th>
                    <th className="py-2 pr-3 text-right">Net Cash Flow</th>
                  </tr>
                </thead>
                <tbody>
                  {cashFlows.map((cf, i) => (
                    <tr key={i} className="border-t">
                      <td className="py-2 pr-3 font-medium">{i}</td>
                      <td className={`py-2 pr-3 text-right font-mono ${cf < 0 ? "text-destructive" : "text-foreground"}`}>
                        {formatINR(cf || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex justify-end">
              <Button type="button" onClick={() => setShowResults(true)} className="gap-2">
                <Calculator className="size-4" />
                Calculate MIRR
              </Button>
            </div>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 self-start">
          {!showResults ? (
            <div className="rounded-2xl border bg-card p-8 text-center">
              <Calculator className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Fill in the cash flows and click <span className="font-medium text-foreground">Calculate</span> to see the analysis.
              </p>
            </div>
          ) : (
            <>
              <div
                className={`rounded-2xl border p-6 shadow-sm ${
                  mirrValue == null
                    ? "bg-primary text-primary-foreground"
                    : mirrValue >= hurdleRate
                    ? "bg-success text-success-foreground"
                    : "bg-destructive text-destructive-foreground"
                }`}
              >
                <div className="text-xs uppercase tracking-wide opacity-70">Modified IRR</div>
                <div className="mt-1 font-display text-5xl font-semibold">
                  {mirrValue == null ? "—" : `${(mirrValue * 100).toFixed(2)}%`}
                </div>
                <div className="mt-1 text-sm opacity-80">Reinvestment &amp; finance rate: WACC</div>
              </div>

              {decision && (
                <div
                  className={`rounded-2xl border p-5 ${
                    decision.tone === "success"
                      ? "bg-success/10 border-success/30 text-success"
                      : "bg-destructive/10 border-destructive/30 text-destructive"
                  }`}
                >
                  <div className="text-xs uppercase tracking-wide">Recommendation</div>
                  <div className="mt-1 font-display text-2xl font-semibold">{decision.label}</div>
                  <p className="mt-1 text-sm opacity-90">{decision.reason}</p>
                </div>
              )}

              {mirrValue == null && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-700 dark:text-amber-400">
                  <div className="font-semibold">MIRR cannot be calculated</div>
                  <p className="mt-1 opacity-90">
                    {!hasNegative && "There is no initial investment (negative cash flow). Increase Capex or Cash Outflow at Year 0."}
                    {hasNegative && !hasPositive && "There are no positive cash flows. Add Project Sales / NFR income."}
                  </p>
                </div>
              )}

              <div className="rounded-2xl border bg-card p-5 text-sm">
                <Row label="IRR" value={irrValue == null ? "—" : `${(irrValue * 100).toFixed(2)}%`} />
                <Row label="MIRR" value={mirrValue == null ? "—" : `${(mirrValue * 100).toFixed(2)}%`} />
                <Row label={`NPV @ Hurdle ${(hurdleRate * 100).toFixed(2)}%`} value={formatINR(npvValue || 0)} />
                <Row label="Payback Period" value={payback == null ? "Not recovered" : `${payback.toFixed(2)} yrs`} />
                <Row label="WACC" value={`${(wacc * 100).toFixed(1)}%`} />
                <Row label="Hurdle Rate" value={`${(hurdleRate * 100).toFixed(2)}%`} />
                <Row label="RO Type" value={roType === "new" ? "New RO" : "Existing RO"} />
                <Row label="Horizon" value={`${yearsN} year${yearsN > 1 ? "s" : ""}`} />
              </div>

              <p className="text-xs text-muted-foreground">
                MIRR assumes positive cash flows are reinvested at WACC and financed at WACC. The project is acceptable when MIRR &gt; Hurdle Rate.
              </p>
            </>
          )}
        </aside>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 first:pt-0 last:pb-0 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  );
}

function NumInput({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number | "";
  onChange: (v: number | "") => void;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value === "" ? "" : value}
      min={min}
      max={max}
      step={step}
      placeholder="0"
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") return onChange("");
        const v = parseFloat(raw);
        onChange(Number.isFinite(v) ? v : "");
      }}
      className="w-full rounded-lg border bg-background px-3 py-2 font-mono outline-none ring-accent/40 transition focus:border-accent focus:ring-2"
    />
  );
}
