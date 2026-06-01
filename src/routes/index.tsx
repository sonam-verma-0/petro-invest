import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Calculator, Info } from "lucide-react";
import {
  BarChart,
  Bar,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { mirr, npv, irr, paybackPeriod, discountedPaybackPeriod } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PETRO INVEST — MIRR for Indian Oil Projects" },
      {
        name: "description",
        content:
          "Evaluate Retail Outlet (RO) projects with MIRR, IRR, NPV and payback.",
      },
    ],
  }),
  component: Index,
});

type MetricKey = "mirr" | "irr" | "npv" | "payback" | "decision";

function unitLabel(u: "cr" | "lakh" | "rupee") {
  return u === "cr" ? "₹ Cr" : u === "lakh" ? "₹ Lakh" : "₹";
}


function Index() {
  const [projectName, setProjectName] = useState<string>("New RO Project");
  const [roType, setRoType] = useState<"existing" | "new">("new");
  const [years, setYears] = useState<number | "">(5);

  // Unit selector: all monetary inputs are interpreted in this unit.
  // Math is unit-agnostic but display & expected outputs assume Crore.
  const [unit, setUnit] = useState<"cr" | "lakh" | "rupee">("cr");
  const unitMultiplier = unit === "cr" ? 1e7 : unit === "lakh" ? 1e5 : 1;

  const [capex, setCapex] = useState<number | "">("");
  const [annualSales, setAnnualSales] = useState<number | "">("");
  const [annualNfr, setAnnualNfr] = useState<number | "">("");
  const [annualRevenueExp, setAnnualRevenueExp] = useState<number | "">("");
  const [annualTaxBenefit, setAnnualTaxBenefit] = useState<number | "">("");

  const [waccPct, setWaccPct] = useState<number | "">(9.7);
  const [financeRatePct, setFinanceRatePct] = useState<number | "">(9.7);
  const [reinvestRatePct, setReinvestRatePct] = useState<number | "">(9.7);
  const [hurdleRatePct, setHurdleRatePct] = useState<number | "">(12);

  const [showResults, setShowResults] = useState(false);
  const [openMetric, setOpenMetric] = useState<MetricKey | null>(null);

  const n = (v: number | "") => (v === "" ? 0 : v);
  const wacc = n(waccPct) / 100;
  const financeRate = n(financeRatePct) / 100;
  const reinvestRate = n(reinvestRatePct) / 100;
  const hurdleRate = n(hurdleRatePct) / 100;
  const yearsN = Math.max(0, Math.floor(n(years)));

  // Annual net cash flow auto-derived from line items.
  const annualNetUser =
    n(annualSales) + n(annualNfr) + n(annualTaxBenefit) - n(annualRevenueExp);
  const annualNet = annualNetUser * unitMultiplier;
  const capexRupees = n(capex) * unitMultiplier;

  // Unit-aware display formatter for rupee amounts.
  const fmtUnit = (v: number) => {
    const scaled = v / unitMultiplier;
    const suffix = unit === "cr" ? " Cr" : unit === "lakh" ? " L" : "";
    return `₹${scaled.toLocaleString("en-IN", { maximumFractionDigits: 2 })}${suffix}`;
  };

  const cashFlows = useMemo(() => {
    const flows: number[] = [-capexRupees];
    for (let i = 1; i <= yearsN; i++) flows.push(annualNet);
    return flows;
  }, [yearsN, capexRupees, annualNet]);

  const hasNegative = cashFlows.some((v) => v < 0);
  const hasPositive = cashFlows.some((v) => v > 0);

  const mirrValue = useMemo(
    () => mirr(cashFlows, financeRate, reinvestRate),
    [cashFlows, financeRate, reinvestRate],
  );
  const irrValue = useMemo(() => irr(cashFlows), [cashFlows]);
  const npvValue = useMemo(() => npv(wacc, cashFlows), [cashFlows, wacc]);
  const payback = useMemo(() => paybackPeriod(cashFlows), [cashFlows]);

  // Debug output so the formulas can be verified step-by-step.
  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.log("[PETRO INVEST] debug", {
      unit,
      unitMultiplier,
      ratesDecimal: { wacc, financeRate, reinvestRate, hurdleRate },
      cashFlowsRupees: cashFlows,
      cashFlowsInUnit: cashFlows.map((v) => v / unitMultiplier),
      mirr: mirrValue,
      irr: irrValue,
      npv: npvValue,
      payback,
    });
  }


  const decision =
    mirrValue == null
      ? null
      : mirrValue >= hurdleRate
        ? {
            label: "INVEST",
            tone: "success" as const,
            reason: `MIRR ${(mirrValue * 100).toFixed(2)}% ≥ Hurdle Rate ${(hurdleRate * 100).toFixed(2)}%`,
          }
        : {
            label: "REJECT",
            tone: "destructive" as const,
            reason: `MIRR ${(mirrValue * 100).toFixed(2)}% < Hurdle Rate ${(hurdleRate * 100).toFixed(2)}%`,
          };

  // Chart data
  const chartData = useMemo(() => {
    let cum = 0;
    return cashFlows.map((cf, i) => {
      cum += cf;
      return { year: `Y${i}`, cashFlow: cf, cumulative: cum };
    });
  }, [cashFlows]);

  const calculate = () => setShowResults(true);

  return (
    <TooltipProvider delayDuration={150}>
      <main className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-10 flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              <span className="size-1.5 rounded-full bg-accent" /> Capital
              Budgeting · Retail Outlet
            </div>
            <h1 className="mt-3 text-4xl font-semibold text-foreground md:text-5xl">
              PETRO INVEST
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Evaluate Indian Oil retail outlet projects with MIRR, IRR, NPV and
              payback — with transparent, click-to-explain calculations.
            </p>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1fr_400px]">
          <div className="space-y-6">
            {/* Project details */}
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Project details</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Project Name">
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 outline-none ring-accent/40 transition focus:border-accent focus:ring-2"
                  />
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
                <Field label="Number of Years (excluding Year 0)">
                  <NumInput value={years} onChange={setYears} min={1} max={30} />
                </Field>
              </div>
            </div>

            {/* Capex + Annual line items */}
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold">
                    Capex &amp; annual cash flow
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Capex is a one-time Year 0 outflow. Annual values repeat
                    each year (Year 1 to Year {yearsN}).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Unit:</span>
                  {(
                    [
                      ["cr", "₹ Crore"],
                      ["lakh", "₹ Lakh"],
                      ["rupee", "₹"],
                    ] as const
                  ).map(([k, lbl]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setUnit(k)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                        unit === k
                          ? "border-accent bg-accent text-accent-foreground"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field
                  label={`Capex — Year 0 lump sum (${unitLabel(unit)})`}
                  tip="Initial investment required at Year 0."
                >
                  <NumInput value={capex} onChange={setCapex} />
                </Field>
                <Field
                  label={`Project Sales — annual (${unitLabel(unit)})`}
                  tip="Expected annual sales revenue."
                >
                  <NumInput value={annualSales} onChange={setAnnualSales} />
                </Field>
                <Field
                  label={`NFR Income — annual (${unitLabel(unit)})`}
                  tip="Non-fuel retail income generated annually."
                >
                  <NumInput value={annualNfr} onChange={setAnnualNfr} />
                </Field>
                <Field
                  label={`Revenue Expenditure — annual (${unitLabel(unit)})`}
                  tip="Annual operating expenses."
                >
                  <NumInput
                    value={annualRevenueExp}
                    onChange={setAnnualRevenueExp}
                  />
                </Field>
                <Field
                  label={`Income Tax Benefit — annual (${unitLabel(unit)})`}
                  tip="Annual tax savings or tax benefits."
                >
                  <NumInput
                    value={annualTaxBenefit}
                    onChange={setAnnualTaxBenefit}
                  />
                </Field>
              </div>
            </div>



            {/* Discount & hurdle rates */}
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Discount &amp; hurdle rates</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field
                  label="WACC %"
                  tip="Weighted Average Cost of Capital — used to discount NPV."
                >
                  <NumInput
                    value={waccPct}
                    onChange={setWaccPct}
                    min={0}
                    max={100}
                    step="0.1"
                  />
                </Field>
                <Field
                  label="Finance Rate % (MIRR)"
                  tip="Discount rate applied to negative (financing) cash flows in MIRR."
                >
                  <NumInput
                    value={financeRatePct}
                    onChange={setFinanceRatePct}
                    min={0}
                    max={100}
                    step="0.1"
                  />
                </Field>
                <Field
                  label="Reinvestment Rate % (MIRR)"
                  tip="Rate at which positive cash flows are reinvested in MIRR."
                >
                  <NumInput
                    value={reinvestRatePct}
                    onChange={setReinvestRatePct}
                    min={0}
                    max={100}
                    step="0.1"
                  />
                </Field>
                <Field
                  label="Hurdle Rate %"
                  tip="Minimum acceptable MIRR. Used ONLY for the invest/reject decision."
                >
                  <NumInput
                    value={hurdleRatePct}
                    onChange={setHurdleRatePct}
                    min={0}
                    max={100}
                    step="0.1"
                  />
                </Field>
              </div>
            </div>

            {/* Year-by-year table + chart */}
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Cash flow timeline</h2>
                <span className="text-xs text-muted-foreground">
                  Auto-generated
                </span>
              </div>

              <div className="mt-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="oklch(0.9 0.01 260)"
                    />
                    <XAxis dataKey="year" />
                    <YAxis
                      tickFormatter={(v) => fmtUnit(Number(v))}
                      width={80}
                    />
                    <RTooltip
                      formatter={(value: number, name) => [
                        fmtUnit(value),
                        name === "cashFlow" ? "Net cash flow" : "Cumulative",
                      ]}
                    />
                    <ReferenceLine y={0} stroke="oklch(0.5 0.02 260)" />
                    <Bar dataKey="cashFlow" radius={[4, 4, 0, 0]}>
                      {chartData.map((d, i) => (
                        <Cell
                          key={i}
                          fill={
                            d.cashFlow < 0
                              ? "oklch(0.6 0.22 27)"
                              : "oklch(0.68 0.18 45)"
                          }
                        />
                      ))}
                    </Bar>
                    <Line
                      type="monotone"
                      dataKey="cumulative"
                      stroke="oklch(0.22 0.07 260)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[500px] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3">Year</th>
                      <th className="py-2 pr-3 text-right">Net Cash Flow</th>
                      <th className="py-2 pr-3 text-right">Cumulative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((d, i) => (
                      <tr key={i} className="border-t">
                        <td className="py-2 pr-3 font-medium">{d.year}</td>
                        <td
                          className={`py-2 pr-3 text-right font-mono ${d.cashFlow < 0 ? "text-destructive" : "text-success"}`}
                        >
                          {fmtUnit(d.cashFlow || 0)}
                        </td>
                        <td
                          className={`py-2 pr-3 text-right font-mono ${d.cumulative < 0 ? "text-destructive" : "text-foreground"}`}
                        >
                          {fmtUnit(d.cumulative || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <Button type="button" onClick={calculate} className="gap-2">
                  <Calculator className="size-4" />
                  Calculate
                </Button>
              </div>
            </div>
          </div>

          {/* Results panel */}
          <aside className="space-y-4 lg:sticky lg:top-6 self-start">
            {!showResults ? (
              <div className="rounded-2xl border bg-card p-8 text-center">
                <Calculator className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Fill in the cash flows and click{" "}
                  <span className="font-medium text-foreground">Calculate</span>{" "}
                  to see the analysis.
                </p>
              </div>
            ) : (
              <>
                {/* MIRR hero card */}
                <button
                  type="button"
                  onClick={() => setOpenMetric("mirr")}
                  className={`w-full rounded-2xl border p-6 text-left shadow-sm transition hover:opacity-95 ${
                    mirrValue == null
                      ? "bg-primary text-primary-foreground"
                      : mirrValue >= hurdleRate
                        ? "bg-success text-success-foreground"
                        : "bg-destructive text-destructive-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide opacity-80">
                    Modified IRR <Info className="size-3.5" />
                  </div>
                  <div className="mt-1 font-display text-5xl font-semibold">
                    {mirrValue == null
                      ? "—"
                      : `${(mirrValue * 100).toFixed(2)}%`}
                  </div>
                  <div className="mt-1 text-sm opacity-80">
                    Finance &amp; reinvestment at WACC · click to see steps
                  </div>
                </button>

                {/* Decision banner */}
                {decision && (
                  <button
                    type="button"
                    onClick={() => setOpenMetric("decision")}
                    className={`w-full rounded-2xl border p-5 text-left transition hover:opacity-95 ${
                      decision.tone === "success"
                        ? "bg-success/10 border-success/30 text-success"
                        : "bg-destructive/10 border-destructive/30 text-destructive"
                    }`}
                  >
                    <div className="text-xs uppercase tracking-wide">
                      Recommendation
                    </div>
                    <div className="mt-1 font-display text-2xl font-semibold">
                      {decision.label}
                    </div>
                    <p className="mt-1 text-sm opacity-90">{decision.reason}</p>
                  </button>
                )}

                {mirrValue == null && (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-700 dark:text-amber-400">
                    <div className="font-semibold">
                      MIRR cannot be calculated
                    </div>
                    <p className="mt-1 opacity-90">
                      {!hasNegative &&
                        "There is no Year 0 outflow. Enter a Capex value."}
                      {hasNegative &&
                        !hasPositive &&
                        "There are no positive cash flows. Add Project Sales / NFR income."}
                    </p>
                  </div>
                )}

                {/* Metric grid */}
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    label="IRR"
                    value={
                      irrValue == null
                        ? "—"
                        : `${(irrValue * 100).toFixed(2)}%`
                    }
                    subtitle="Internal Rate of Return"
                    onClick={() => setOpenMetric("irr")}
                  />
                  <MetricCard
                    label={`NPV @ ${(wacc * 100).toFixed(1)}%`}
                    value={fmtUnit(npvValue || 0)}
                    subtitle="Net Present Value"
                    positive={npvValue >= 0}
                    onClick={() => setOpenMetric("npv")}
                  />
                  <MetricCard
                    label="Payback"
                    value={
                      payback == null
                        ? "Not recovered"
                        : `${payback.toFixed(2)} yrs`
                    }
                    subtitle="Years to recover Capex"
                    onClick={() => setOpenMetric("payback")}
                  />
                  <MetricCard
                    label="Annual Net CF"
                    value={fmtUnit(annualNet || 0)}
                    subtitle="Sales+NFR+Tax−Expenses"
                    positive={annualNet >= 0}
                  />
                </div>

                <div className="rounded-2xl border bg-card p-5 text-sm">
                  <Row label="Project" value={projectName} />
                  <Row
                    label="RO Type"
                    value={roType === "new" ? "New RO" : "Existing RO"}
                  />
                  <Row
                    label="Horizon"
                    value={`${yearsN} year${yearsN > 1 ? "s" : ""}`}
                  />
                  <Row label="WACC" value={`${(wacc * 100).toFixed(2)}%`} />
                  <Row
                    label="Finance Rate"
                    value={`${(financeRate * 100).toFixed(2)}%`}
                  />
                  <Row
                    label="Reinvestment Rate"
                    value={`${(reinvestRate * 100).toFixed(2)}%`}
                  />
                  <Row
                    label="Hurdle Rate"
                    value={`${(hurdleRate * 100).toFixed(2)}%`}
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Click any metric card to see the formula, substituted values
                  and decision logic.
                </p>
              </>
            )}
          </aside>
        </section>

        {/* Explainer dialog */}
        <ExplainerDialog
          open={openMetric}
          onClose={() => setOpenMetric(null)}
          ctx={{
            cashFlows,
            mirrValue,
            irrValue,
            npvValue,
            payback,
            wacc,
            financeRate,
            reinvestRate,
            hurdleRate,
            yearsN,
            annualNet,
            capex: n(capex),
            fmt: fmtUnit,
          }}
        />
      </main>
    </TooltipProvider>
  );
}

// ---------- Sub-components ----------

function Field({
  label,
  children,
  tip,
}: {
  label: string;
  children: React.ReactNode;
  tip?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
        {label}
        {tip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="size-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{tip}</TooltipContent>
          </Tooltip>
        )}
      </span>
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

function MetricCard({
  label,
  value,
  subtitle,
  positive,
  onClick,
}: {
  label: string;
  value: string;
  subtitle: string;
  positive?: boolean;
  onClick?: () => void;
}) {
  const tone =
    positive === undefined
      ? "text-foreground"
      : positive
        ? "text-success"
        : "text-destructive";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-accent/50 disabled:cursor-default disabled:hover:border-border"
    >
      <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        {label} {onClick && <Info className="size-3" />}
      </div>
      <div className={`mt-1 font-mono text-xl font-semibold ${tone}`}>
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>
    </button>
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

// ---------- Explainer ----------

type ExplainerCtx = {
  cashFlows: number[];
  mirrValue: number | null;
  irrValue: number | null;
  npvValue: number;
  payback: number | null;
  wacc: number;
  financeRate: number;
  reinvestRate: number;
  hurdleRate: number;
  yearsN: number;
  annualNet: number;
  capex: number;
  fmt: (v: number) => string;
};

function ExplainerDialog({
  open,
  onClose,
  ctx,
}: {
  open: MetricKey | null;
  onClose: () => void;
  ctx: ExplainerCtx;
}) {
  const titleMap: Record<MetricKey, string> = {
    mirr: "MIRR — Modified Internal Rate of Return",
    irr: "IRR — Internal Rate of Return",
    npv: "NPV — Net Present Value",
    payback: "Payback Period",
    decision: "Investment Recommendation",
  };

  return (
    <Dialog open={open !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{open && titleMap[open]}</DialogTitle>
          <DialogDescription>
            Formula, substituted values, and how this number drives the
            decision.
          </DialogDescription>
        </DialogHeader>

        {open === "mirr" && <MirrExplain ctx={ctx} />}
        {open === "irr" && <IrrExplain ctx={ctx} />}
        {open === "npv" && <NpvExplain ctx={ctx} />}
        {open === "payback" && <PaybackExplain ctx={ctx} />}
        {open === "decision" && <DecisionExplain ctx={ctx} />}
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="mt-2 text-sm">{children}</div>
    </div>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <pre className="rounded-lg border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap">
      {children}
    </pre>
  );
}


function MirrExplain({ ctx }: { ctx: ExplainerCtx }) {
  const { cashFlows, financeRate, reinvestRate, mirrValue, hurdleRate } = ctx;
  const n = cashFlows.length - 1;
  let pvNeg = 0;
  let fvPos = 0;
  cashFlows.forEach((v, i) => {
    if (v < 0) pvNeg += v / Math.pow(1 + financeRate, i);
    else if (v > 0) fvPos += v * Math.pow(1 + reinvestRate, n - i);
  });

  return (
    <>
      <Section title="Formula">
        <Formula>{`MIRR = ( FV of positive cash flows / PV of negative cash flows )^(1/n) − 1`}</Formula>
      </Section>
      <Section title="Cash flow timeline">
        <ul className="space-y-1 font-mono text-xs">
          {cashFlows.map((cf, i) => (
            <li
              key={i}
              className={cf < 0 ? "text-destructive" : "text-success"}
            >
              Y{i} = {cf >= 0 ? "+" : ""}
              {ctx.fmt(cf)}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Substituted values">
        <Formula>
          {`Finance Rate     = ${(financeRate * 100).toFixed(2)}%
Reinvest Rate    = ${(reinvestRate * 100).toFixed(2)}%
n (periods)      = ${n}

FV of positive   = ${ctx.fmt(fvPos)}
PV of negative   = ${ctx.fmt(-pvNeg)}

MIRR = ( ${ctx.fmt(fvPos)} / ${ctx.fmt(-pvNeg)} )^(1/${n}) − 1
     = ${mirrValue == null ? "—" : (mirrValue * 100).toFixed(2) + "%"}`}
        </Formula>
      </Section>
      <Section title="Decision">
        <p>
          MIRR{" "}
          <span className="font-mono">
            {mirrValue == null ? "—" : (mirrValue * 100).toFixed(2) + "%"}
          </span>{" "}
          vs Hurdle Rate{" "}
          <span className="font-mono">
            {(hurdleRate * 100).toFixed(2)}%
          </span>{" "}
          →{" "}
          <strong
            className={
              mirrValue != null && mirrValue >= hurdleRate
                ? "text-success"
                : "text-destructive"
            }
          >
            {mirrValue != null && mirrValue >= hurdleRate
              ? "INVEST"
              : "REJECT"}
          </strong>
        </p>
      </Section>
    </>
  );
}

function IrrExplain({ ctx }: { ctx: ExplainerCtx }) {
  const { irrValue, cashFlows } = ctx;
  return (
    <>
      <Section title="Formula">
        <Formula>{`NPV(IRR) = Σ CFₜ / (1 + IRR)ᵗ = 0`}</Formula>
      </Section>
      <Section title="Interpretation">
        IRR is the discount rate at which the project's NPV equals zero. It
        ignores the cost of capital and assumes reinvestment at IRR itself —
        which is why MIRR is preferred for decision making.
      </Section>
      <Section title="Substituted values">
        <Formula>
          {`Cash flows:
${cashFlows.map((cf, i) => `  Y${i} = ${cf >= 0 ? "+" : ""}${ctx.fmt(cf)}`).join("\n")}

Solve numerically:
IRR = ${irrValue == null ? "—" : (irrValue * 100).toFixed(2) + "%"}`}
        </Formula>
      </Section>
    </>
  );
}

function NpvExplain({ ctx }: { ctx: ExplainerCtx }) {
  const { cashFlows, wacc, npvValue } = ctx;
  const terms = cashFlows.map(
    (cf, i) => `  Y${i}: ${ctx.fmt(cf)} / (1 + ${wacc.toFixed(4)})^${i} = ${ctx.fmt(cf / Math.pow(1 + wacc, i))}`,
  );
  return (
    <>
      <Section title="Formula">
        <Formula>{`NPV = Σ CFₜ / (1 + WACC)ᵗ`}</Formula>
      </Section>
      <Section title="Substituted values">
        <Formula>
          {`WACC = ${(wacc * 100).toFixed(2)}%

${terms.join("\n")}

NPV = ${ctx.fmt(npvValue)}`}
        </Formula>
      </Section>
      <Section title="Interpretation">
        Positive NPV means the project adds value at the discount rate;
        negative NPV destroys value.
      </Section>
    </>
  );
}

function PaybackExplain({ ctx }: { ctx: ExplainerCtx }) {
  const { cashFlows, payback } = ctx;
  let cum = 0;
  const rows = cashFlows.map((cf, i) => {
    cum += cf;
    return `  Y${i}: CF=${ctx.fmt(cf)}   Cumulative=${ctx.fmt(cum)}`;
  });
  return (
    <>
      <Section title="Formula">
        <Formula>{`Payback = year at which cumulative cash flow turns ≥ 0
        (with linear interpolation within the year)`}</Formula>
      </Section>
      <Section title="Substituted values">
        <Formula>
          {`${rows.join("\n")}

Payback = ${payback == null ? "Not recovered within horizon" : payback.toFixed(2) + " years"}`}
        </Formula>
      </Section>
    </>
  );
}

function DecisionExplain({ ctx }: { ctx: ExplainerCtx }) {
  const { mirrValue, hurdleRate } = ctx;
  const ok = mirrValue != null && mirrValue >= hurdleRate;
  return (
    <>
      <Section title="Rule">
        <Formula>{`IF MIRR >= Hurdle Rate  →  INVEST
ELSE                    →  REJECT`}</Formula>
      </Section>
      <Section title="Applied">
        <Formula>
          {`MIRR        = ${mirrValue == null ? "—" : (mirrValue * 100).toFixed(2) + "%"}
Hurdle Rate = ${(hurdleRate * 100).toFixed(2)}%

→ ${ok ? "INVEST" : "REJECT"}`}
        </Formula>
      </Section>
      <Section title="Why MIRR, not IRR?">
        MIRR corrects IRR's unrealistic assumption that interim cash flows are
        reinvested at the IRR itself. MIRR reinvests them at the WACC, giving a
        more honest return measure that can be compared directly to the hurdle
        rate.
      </Section>
    </>
  );
}
