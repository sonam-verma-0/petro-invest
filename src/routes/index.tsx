import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { mirr, npv, formatINR } from "@/lib/finance";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RO Investment Analyzer — MIRR for Indian Oil Projects" },
      { name: "description", content: "Evaluate Retail Outlet (RO) projects with MIRR, NPV at 9.7% WACC and tax-adjusted cash flows." },
    ],
  }),
  component: Index,
});

function Index() {
  const [ci, setCi] = useState<number>(0);
  const [co, setCo] = useState<number>(0);
  const [capex, setCapex] = useState<number>(0);
  const [roType, setRoType] = useState<"existing" | "new">("new");
  const [years, setYears] = useState<number>(5);
  const wacc = 0.097;

  // Annual values
  const [annualSales, setAnnualSales] = useState<number>(0);
  const [annualNfr, setAnnualNfr] = useState<number>(0);
  const [annualRevenueExp, setAnnualRevenueExp] = useState<number>(0);
  const [annualTaxBenefit, setAnnualTaxBenefit] = useState<number>(0);

  const [showResults, setShowResults] = useState(false);

  const cashFlows = useMemo(() => {
    const totalYears = years; // Year 0..n where n = years
    const flows: number[] = [];
    for (let i = 0; i <= totalYears; i++) {
      if (i === 1) {
        const inflow = annualSales + annualNfr + annualTaxBenefit;
        const outflow = annualRevenueExp + capex;
        flows.push(ci - co + inflow - outflow);
      } else if (i === 0) {
        flows.push(ci - co);
      } else {
        const inflow = annualSales + annualNfr + annualTaxBenefit;
        const outflow = annualRevenueExp;
        flows.push(inflow - outflow);
      }
    }
    return flows;
  }, [years, ci, co, capex, annualSales, annualNfr, annualRevenueExp, annualTaxBenefit]);

  const mirrValue = useMemo(() => mirr(cashFlows, wacc, wacc), [cashFlows]);
  const npvValue = useMemo(() => npv(wacc, cashFlows), [cashFlows]);

  const decision = mirrValue == null
    ? null
    : mirrValue > wacc
    ? { label: "Invest", tone: "success" as const, reason: `MIRR ${(mirrValue * 100).toFixed(2)}% exceeds WACC ${(wacc * 100).toFixed(1)}%.` }
    : { label: "Do Not Invest", tone: "destructive" as const, reason: `MIRR ${(mirrValue * 100).toFixed(2)}% is below WACC ${(wacc * 100).toFixed(1)}%.` };

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-10 flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <span className="size-1.5 rounded-full bg-accent" /> Capital Budgeting · Retail Outlet
          </div>
          <h1 className="mt-3 text-4xl font-semibold text-foreground md:text-5xl">
            RO Investment Analyzer
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Decide whether to invest in a new or existing retail outlet project using MIRR
            against a {(wacc * 100).toFixed(1)}% WACC hurdle.
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4 text-sm">
          <div className="text-muted-foreground">WACC (fixed)</div>
          <div className="font-display text-2xl font-semibold">{(wacc * 100).toFixed(1)}%</div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Project setup */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Project setup</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Cash Inflow at Year 0 (CI) ₹">
                <NumInput value={ci} onChange={setCi} />
              </Field>
              <Field label="Cash Outflow at Year 0 (CO) ₹">
                <NumInput value={co} onChange={setCo} />
              </Field>
              <Field label="One-time Capex ₹">
                <NumInput value={capex} onChange={setCapex} />
              </Field>
              <Field label="RO Type">
                <div className="flex gap-2">
                  {(["new", "existing"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setRoType(t)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ${
                        roType === t
                          ? "border-accent bg-accent text-accent-foreground"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      {t} RO
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Number of years (Year 0 is start)">
                <NumInput value={years} onChange={setYears} min={1} max={30} />
              </Field>
            </div>
          </div>

          {/* Annual inputs */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Annual operating cash flows</h2>
              <span className="text-xs text-muted-foreground">These repeat every year</span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Project Sales (annual) ₹">
                <NumInput value={annualSales} onChange={setAnnualSales} />
              </Field>
              <Field label="NFR Income (annual) ₹">
                <NumInput value={annualNfr} onChange={setAnnualNfr} />
              </Field>
              <Field label="Revenue Expenses (annual) ₹">
                <NumInput value={annualRevenueExp} onChange={setAnnualRevenueExp} />
              </Field>
              <Field label="Income Tax Benefit (annual) ₹">
                <NumInput value={annualTaxBenefit} onChange={setAnnualTaxBenefit} />
              </Field>
            </div>
          </div>

          {/* Yearly breakdown (auto-generated) */}
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
              <Button
                type="button"
                onClick={() => setShowResults(true)}
                className="gap-2"
              >
                <Calculator className="size-4" />
                Calculate MIRR
              </Button>
            </div>
          </div>
        </div>

        {/* Result */}
        <aside className="space-y-4 lg:sticky lg:top-6 self-start">
          {!showResults ? (
            <div className="rounded-2xl border bg-card p-8 text-center">
              <Calculator className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Fill in the cash flows and click <span className="font-medium text-foreground">Calculate MIRR</span> to see the analysis.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border bg-primary p-6 text-primary-foreground shadow-sm">
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

              <div className="rounded-2xl border bg-card p-5 text-sm">
                <Row label="NPV @ WACC" value={formatINR(npvValue || 0)} />
                <Row label="RO Type" value={roType === "new" ? "New RO" : "Existing RO"} />
                <Row label="Horizon" value={`${years} year${years > 1 ? "s" : ""}`} />
                <Row label="Hurdle Rate" value={`${(wacc * 100).toFixed(1)}%`} />
              </div>

              <p className="text-xs text-muted-foreground">
                MIRR assumes positive cash flows are reinvested at WACC and financed at WACC.
                A project is acceptable when MIRR &gt; WACC.
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
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        onChange(Number.isFinite(v) ? v : 0);
      }}
      className="w-full rounded-lg border bg-background px-3 py-2 font-mono outline-none ring-accent/40 transition focus:border-accent focus:ring-2"
    />
  );
}
