import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Calculator, Info, RotateCcw } from "lucide-react";
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
import indianOilLogo from "@/assets/indianoil-logo.png.asset.json";
import petroInvestLogo from "@/assets/capital-lens-logo.png.asset.json";
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
      { title: "PETRO INVEST — Capital Budgeting & Investment Evaluator" },
      {
        name: "description",
        content:
          "Transform project proposals into investment decisions through transparent financial analytics and risk-adjusted returns.",
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
  const [projectName, setProjectName] = useState<string>("New IOCL Project");
  const [projectType, setProjectType] = useState<"existing" | "new">("new");
  const [years, setYears] = useState<number | "">(5);

  // Unit selector: all monetary inputs are interpreted in this unit.
  // Math is unit-agnostic but display & expected outputs assume Crore.
  const [unit, setUnit] = useState<"cr" | "lakh" | "rupee">("cr");
  const unitMultiplier = unit === "cr" ? 1e7 : unit === "lakh" ? 1e5 : 1;

  const [capex, setCapex] = useState<number | "">("");
  const [salesMode, setSalesMode] = useState<"constant" | "yearwise">("constant");
  const [annualSales, setAnnualSales] = useState<number | "">("");
  const [annualNfr, setAnnualNfr] = useState<number | "">("");
  const [annualRevenueExp, setAnnualRevenueExp] = useState<number | "">("");
  const [annualDepreciation, setAnnualDepreciation] = useState<number | "">("");
  const [annualTaxRatePct, setAnnualTaxRatePct] = useState<number | "">(25);
  const [yearlySales, setYearlySales] = useState<Array<number | "">>(() => Array(5).fill(""));
  const [yearlyNfr, setYearlyNfr] = useState<Array<number | "">>(() => Array(5).fill(""));
  const [yearlyRevExp, setYearlyRevExp] = useState<Array<number | "">>(() => Array(5).fill(""));
  const [yearlyDepreciation, setYearlyDepreciation] = useState<Array<number | "">>(() => Array(5).fill(""));
  const [yearlyTaxRatePct, setYearlyTaxRatePct] = useState<Array<number | "">>(() => Array(5).fill(25));

  // Year-wise auto growth / escalation
  const [salesGrowthPct, setSalesGrowthPct] = useState<number | "">(0);
  const [expEscalationPct, setExpEscalationPct] = useState<number | "">(0);
  const [autoGrowSales, setAutoGrowSales] = useState<boolean>(false);
  const [autoEscalateExp, setAutoEscalateExp] = useState<boolean>(false);

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

  // Keep year-wise arrays sized to yearsN, preserving entered values.
  useEffect(() => {
    const resize = (prev: Array<number | "">, fillVal: number | "" = ""): Array<number | ""> => {
      if (prev.length === yearsN) return prev;
      const next: Array<number | ""> = Array(yearsN).fill(fillVal);
      for (let i = 0; i < Math.min(prev.length, yearsN); i++) next[i] = prev[i];
      return next;
    };
    setYearlySales((p) => resize(p));
    setYearlyNfr((p) => resize(p));
    setYearlyRevExp((p) => resize(p));
    setYearlyDepreciation((p) => resize(p));
    setYearlyTaxRatePct((p) => resize(p, 25));
  }, [yearsN]);

  // Mode switcher: when switching to year-wise, copy constant values into every year.
  const switchSalesMode = (mode: "constant" | "yearwise") => {
    if (mode === salesMode) return;
    if (mode === "yearwise") {
      setYearlySales(Array(yearsN).fill(annualSales));
      setYearlyNfr(Array(yearsN).fill(annualNfr));
      setYearlyRevExp(Array(yearsN).fill(annualRevenueExp));
      setYearlyDepreciation(Array(yearsN).fill(annualDepreciation));
      setYearlyTaxRatePct(Array(yearsN).fill(annualTaxRatePct));
    }
    setSalesMode(mode);
  };

  // Propagate values forward from a given index using a percentage rate.
  const propagate = (arr: Array<number | "">, fromIdx: number, ratePct: number): Array<number | ""> => {
    const next = [...arr];
    const rate = ratePct / 100;
    for (let i = Math.max(fromIdx, 0) + 1; i < next.length; i++) {
      const prev = next[i - 1];
      const prevNum = typeof prev === "number" ? prev : prev === "" ? 0 : Number(prev) || 0;
      const val = prevNum * (1 + rate);
      next[i] = Math.round(val * 100) / 100;
    }
    return next;
  };

  // Toggle auto-grow and immediately propagate from Y1.
  const toggleAutoGrowSales = (checked: boolean) => {
    setAutoGrowSales(checked);
    if (checked) setYearlySales((prev) => propagate(prev, 0, n(salesGrowthPct)));
  };
  const toggleAutoEscalateExp = (checked: boolean) => {
    setAutoEscalateExp(checked);
    if (checked) setYearlyRevExp((prev) => propagate(prev, 0, n(expEscalationPct)));
  };

  const onSalesGrowthChange = (v: number | "") => {
    setSalesGrowthPct(v);
    if (autoGrowSales) setYearlySales((prev) => propagate(prev, 0, n(v)));
  };
  const onExpEscalationChange = (v: number | "") => {
    setExpEscalationPct(v);
    if (autoEscalateExp) setYearlyRevExp((prev) => propagate(prev, 0, n(v)));
  };

  const capexRupees = n(capex) * unitMultiplier;

  // Unit-aware display formatter for rupee amounts.
  const fmtUnit = (v: number) => {
    const scaled = v / unitMultiplier;
    const suffix = unit === "cr" ? " Cr" : unit === "lakh" ? " L" : "";
    return `₹${scaled.toLocaleString("en-IN", { maximumFractionDigits: 2 })}${suffix}`;
  };

  // Per-year cash flow breakdown in display units (sales/nfr/exp/dep/taxRate -> CBT/Tax/CFAT/Net)
  type YearBreakdown = {
    sales: number;
    nfr: number;
    revExp: number;
    depreciation: number;
    taxRatePct: number;
    cbt: number;
    tax: number;
    cfat: number;
    netUnit: number;
  };

  const yearBreakdowns = useMemo<YearBreakdown[]>(() => {
    const out: YearBreakdown[] = [];
    for (let i = 0; i < yearsN; i++) {
      const sales = salesMode === "yearwise" ? n(yearlySales[i]) : n(annualSales);
      const nfr = salesMode === "yearwise" ? n(yearlyNfr[i]) : n(annualNfr);
      const revExp = salesMode === "yearwise" ? n(yearlyRevExp[i]) : n(annualRevenueExp);
      const depreciation = salesMode === "yearwise" ? n(yearlyDepreciation[i]) : n(annualDepreciation);
      const taxRatePct = salesMode === "yearwise" ? n(yearlyTaxRatePct[i]) : n(annualTaxRatePct);
      const cbt = sales + nfr - revExp - depreciation;
      const tax = cbt * (taxRatePct / 100);
      const cfat = cbt - tax;
      const netUnit = cfat + depreciation;
      out.push({ sales, nfr, revExp, depreciation, taxRatePct, cbt, tax, cfat, netUnit });
    }
    return out;
  }, [
    yearsN,
    salesMode,
    yearlySales,
    yearlyNfr,
    yearlyRevExp,
    yearlyDepreciation,
    yearlyTaxRatePct,
    annualSales,
    annualNfr,
    annualRevenueExp,
    annualDepreciation,
    annualTaxRatePct,
  ]);

  const cashFlows = useMemo(() => {
    const flows: number[] = [-capexRupees];
    for (let i = 0; i < yearsN; i++) {
      flows.push(yearBreakdowns[i].netUnit * unitMultiplier);
    }
    return flows;
  }, [yearsN, capexRupees, yearBreakdowns, unitMultiplier]);

  // Representative year-1 net cash flow used by the summary card / dialog context.
  const annualNet = cashFlows[1] ?? 0;

  const hasNegative = cashFlows.some((v) => v < 0);
  const hasPositive = cashFlows.some((v) => v > 0);

  const mirrValue = useMemo(
    () => mirr(cashFlows, financeRate, reinvestRate),
    [cashFlows, financeRate, reinvestRate],
  );
  const irrValue = useMemo(() => irr(cashFlows), [cashFlows]);
  const npvValue = useMemo(() => npv(wacc, cashFlows), [cashFlows, wacc]);
  const payback = useMemo(() => paybackPeriod(cashFlows), [cashFlows]);
  const discountedPayback = useMemo(
    () => discountedPaybackPeriod(cashFlows, wacc),
    [cashFlows, wacc],
  );

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

  const resetAll = () => {
    setProjectName("New IOCL Project");
    setProjectType("new");
    setYears(5);
    setUnit("cr");
    setCapex("");
    setSalesMode("constant");
    setAnnualSales("");
    setYearlySales(Array(5).fill(""));
    setYearlyNfr(Array(5).fill(""));
    setYearlyRevExp(Array(5).fill(""));
    setYearlyDepreciation(Array(5).fill(""));
    setYearlyTaxRatePct(Array(5).fill(25));
    setSalesGrowthPct(0);
    setExpEscalationPct(0);
    setAutoGrowSales(false);
    setAutoEscalateExp(false);
    setAnnualNfr("");
    setAnnualRevenueExp("");
    setAnnualDepreciation("");
    setAnnualTaxRatePct(25);
    setWaccPct(9.7);
    setFinanceRatePct(9.7);
    setReinvestRatePct(9.7);
    setHurdleRatePct(12);
    setShowResults(false);
    setOpenMetric(null);
  };

  return (
    <TooltipProvider delayDuration={150}>
      <main className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-6">
          <div className="flex flex-row items-center justify-between gap-4">
            <div className="min-w-0 flex items-center">
              <h1 className="sr-only">CAPITAL LENS — Capital Budgeting & Investment Evaluator</h1>
              <img
                src={petroInvestLogo.url}
                alt="CAPITAL LENS — Capital Budgeting & Investment Evaluator"
                className="h-40 sm:h-48 md:h-56 lg:h-64 w-auto object-contain"
                style={{ imageRendering: "-webkit-optimize-contrast" }}
                decoding="async"
                loading="eager"
              />
            </div>
            <div className="shrink-0 flex items-center gap-3 rounded-2xl border border-primary/15 bg-card/80 px-4 py-2.5 shadow-sm backdrop-blur">
              <img
                src={indianOilLogo.url}
                alt="Indian Oil Corporation logo"
                className="h-10 w-10 sm:h-11 sm:w-11 object-contain"
              />
              <div className="border-l border-primary/20 pl-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  In association with
                </div>
                <div className="text-sm font-semibold text-primary leading-tight">
                  Indian Oil Corporation Ltd.
                </div>
              </div>
            </div>
          </div>
          <nav className="text-left -mt-4">
            <p className="text-sm sm:text-base font-normal tracking-wide">
              <span className="text-primary">Evaluate.</span>
              <span className="mx-3 text-muted-foreground/50">|</span>
              <span className="text-primary">Analyze.</span>
              <span className="mx-3 text-muted-foreground/50">|</span>
              <span className="text-accent">Invest.</span>
            </p>
          </nav>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground text-left max-w-3xl">
            Transform project proposals into investment decisions through transparent financial analytics and risk-adjusted returns.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1fr_400px]">
          <div className="space-y-6">
            {/* Project details */}
            <div className="rounded-2xl border border-primary/10 bg-card p-6 shadow-sm">
              <SectionHeader
                title="Project Details"
                subtitle="Identify the proposal and set the evaluation horizon."
              />
              <div className="mt-2 grid gap-4 md:grid-cols-2">
                <Field label="Project Name">
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 outline-none ring-accent/40 transition focus:border-accent focus:ring-2"
                  />
                </Field>
                <Field label="Project Type">
                  <div className="flex gap-2">
                    {(["new", "existing"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setProjectType(t)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ${
                          projectType === t
                            ? "border-accent bg-accent text-accent-foreground"
                            : "bg-background hover:bg-muted"
                        }`}
                      >
                        {t} Project
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
            <div className="rounded-2xl border border-primary/10 bg-card p-6 shadow-sm">
              <SectionHeader
                title="Capex - Annual Cash Flow"
                subtitle={`Capex is a one-time Year 0 outflow. Annual values repeat each year (Year 1 to Year ${yearsN}).`}
                right={
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
                }
              />

              <div className="mt-2 grid gap-4 md:grid-cols-2">
                <Field
                  label={`Capex - Year 0 lump sum (${unitLabel(unit)})`}
                  tip="Initial investment required at Year 0."
                >
                  <NumInput value={capex} onChange={setCapex} />
                </Field>
                <div className="md:col-span-2 rounded-xl border border-primary/10 bg-background/40 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        Recurring Annual Cash Flows ({unitLabel(unit)})
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Choose whether values repeat each year or vary year by year.
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Mode:</span>
                      {(
                        [
                          ["constant", "Constant Annual"],
                          ["yearwise", "Year-wise"],
                        ] as const
                      ).map(([k, lbl]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => switchSalesMode(k)}
                          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                            salesMode === k
                              ? "border-accent bg-accent text-accent-foreground"
                              : "bg-background hover:bg-muted"
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {salesMode === "constant" ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field
                        label={`Project Sales - annual (${unitLabel(unit)})`}
                        tip="Expected annual sales revenue, applied to every year."
                      >
                        <NumInput value={annualSales} onChange={setAnnualSales} />
                      </Field>
                      <Field
                        label={`NFR Income - annual (${unitLabel(unit)})`}
                        tip="Non-fuel retail income generated annually."
                      >
                        <NumInput value={annualNfr} onChange={setAnnualNfr} />
                      </Field>
                      <Field
                        label={`Revenue Expenditure - annual (${unitLabel(unit)})`}
                        tip="Annual operating expenses."
                      >
                        <NumInput value={annualRevenueExp} onChange={setAnnualRevenueExp} />
                      </Field>
                      <Field
                        label={`Depreciation - annual (${unitLabel(unit)})`}
                        tip="Annual depreciation charge. Reduces taxable income but is added back to compute net cash flow."
                      >
                        <NumInput value={annualDepreciation} onChange={setAnnualDepreciation} />
                      </Field>
                      <Field
                        label="Income Tax Rate (%)"
                        tip="Effective corporate income tax rate applied to Cash Flow Before Tax (CBT)."
                      >
                        <NumInput
                          value={annualTaxRatePct}
                          onChange={setAnnualTaxRatePct}
                          min={0}
                          max={100}
                          step="0.1"
                        />
                      </Field>
                    </div>
                  ) : yearsN === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Set the number of years to enter year-wise cash flows.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {/* Auto growth / escalation controls */}
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-primary/10 bg-background/60 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-xs font-medium text-muted-foreground">
                              Sales Growth Rate (%)
                            </label>
                            <label className="inline-flex items-center gap-2 text-xs text-foreground cursor-pointer">
                              <input
                                type="checkbox"
                                checked={autoGrowSales}
                                onChange={(e) => toggleAutoGrowSales(e.target.checked)}
                                className="size-4 rounded border-primary/40 accent-accent"
                              />
                              Auto Calculate
                            </label>
                          </div>
                          <div className="mt-2">
                            <NumInput
                              value={salesGrowthPct}
                              onChange={onSalesGrowthChange}
                              min={-100}
                              max={1000}
                              step="0.1"
                            />
                          </div>
                        </div>
                        <div className="rounded-lg border border-primary/10 bg-background/60 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-xs font-medium text-muted-foreground">
                              Expenditure Escalation Rate (%)
                            </label>
                            <label className="inline-flex items-center gap-2 text-xs text-foreground cursor-pointer">
                              <input
                                type="checkbox"
                                checked={autoEscalateExp}
                                onChange={(e) => toggleAutoEscalateExp(e.target.checked)}
                                className="size-4 rounded border-primary/40 accent-accent"
                              />
                              Auto Calculate
                            </label>
                          </div>
                          <div className="mt-2">
                            <NumInput
                              value={expEscalationPct}
                              onChange={onExpEscalationChange}
                              min={-100}
                              max={1000}
                              step="0.1"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-lg border border-primary/10">
                        <table className="w-full min-w-[760px] text-sm">
                          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium">Year</th>
                              <th className="px-3 py-2 text-left font-medium">Project Sales</th>
                              <th className="px-3 py-2 text-left font-medium">NFR Income</th>
                              <th className="px-3 py-2 text-left font-medium">Revenue Expenditure</th>
                              <th className="px-3 py-2 text-left font-medium">Depreciation</th>
                              <th className="px-3 py-2 text-left font-medium">Income Tax Rate (%)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: yearsN }, (_, i) => {
                              const cellSet = (
                                setter: React.Dispatch<React.SetStateAction<Array<number | "">>>,
                              ) => (v: number | "") =>
                                setter((prev) => {
                                  const next = [...prev];
                                  next[i] = v;
                                  return next;
                                });
                              const setSalesCell = (v: number | "") =>
                                setYearlySales((prev) => {
                                  const next = [...prev];
                                  next[i] = v;
                                  return autoGrowSales ? propagate(next, i, n(salesGrowthPct)) : next;
                                });
                              const setRevExpCell = (v: number | "") =>
                                setYearlyRevExp((prev) => {
                                  const next = [...prev];
                                  next[i] = v;
                                  return autoEscalateExp ? propagate(next, i, n(expEscalationPct)) : next;
                                });
                              return (
                                <tr key={i} className="border-t border-primary/10">
                                  <td className="px-3 py-2 font-medium text-foreground">Y{i + 1}</td>
                                  <td className="px-2 py-1.5">
                                    <NumInput value={yearlySales[i] ?? ""} onChange={setSalesCell} />
                                  </td>
                                  <td className="px-2 py-1.5">
                                    <NumInput value={yearlyNfr[i] ?? ""} onChange={cellSet(setYearlyNfr)} />
                                  </td>
                                  <td className="px-2 py-1.5">
                                    <NumInput value={yearlyRevExp[i] ?? ""} onChange={setRevExpCell} />
                                  </td>
                                  <td className="px-2 py-1.5">
                                    <NumInput value={yearlyDepreciation[i] ?? ""} onChange={cellSet(setYearlyDepreciation)} />
                                  </td>
                                  <td className="px-2 py-1.5">
                                    <NumInput
                                      value={yearlyTaxRatePct[i] ?? ""}
                                      onChange={cellSet(setYearlyTaxRatePct)}
                                      min={0}
                                      max={100}
                                      step="0.1"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>



            {/* Discount & hurdle rates */}
            <div className="rounded-2xl border border-primary/10 bg-card p-6 shadow-sm">
              <SectionHeader
                title="Discount - Hurdle Rates"
                subtitle="Cost of capital and the minimum return required to approve the investment."
              />
              <div className="mt-2 grid gap-4 md:grid-cols-2">
                <Field
                  label="WACC %"
                  tip="Weighted Average Cost of Capital - used to discount NPV."
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
            <div className="rounded-2xl border border-primary/10 bg-card p-6 shadow-sm">
              <SectionHeader
                title="Cash Flow Timeline"
                right={
                  <span className="text-xs text-muted-foreground">
                    Auto-generated
                  </span>
                }
              />


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
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 cursor-help">
                                {fmtUnit(d.cashFlow || 0)}
                                <Info className="size-3 text-muted-foreground/70" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[320px] text-xs leading-relaxed">
                              {i === 0 ? (
                                <>
                                  Year 0 outflow = −Capex = {fmtUnit(d.cashFlow || 0)}
                                </>
                              ) : (() => {
                                const b = yearBreakdowns[i - 1];
                                return (
                                  <div className="space-y-1">
                                    <div className="font-semibold">Year {i} — Net Cash Flow</div>
                                    <div>CBT = Sales + NFR − RevExp − Depreciation</div>
                                    <div>= {b.sales} + {b.nfr} − {b.revExp} − {b.depreciation} = {b.cbt.toFixed(2)}</div>
                                    <div>Tax = CBT × {b.taxRatePct}% = {b.tax.toFixed(2)}</div>
                                    <div>CFAT = CBT − Tax = {b.cfat.toFixed(2)}</div>
                                    <div className="font-semibold border-t border-white/20 pt-1">
                                      Net = CFAT + Depreciation = {b.netUnit.toFixed(2)} → {fmtUnit(d.cashFlow || 0)}
                                    </div>
                                  </div>
                                );
                              })()}
                            </TooltipContent>
                          </Tooltip>
                        </td>
                        <td
                          className={`py-2 pr-3 text-right font-mono ${d.cumulative < 0 ? "text-destructive" : "text-foreground"}`}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 cursor-help">
                                {fmtUnit(d.cumulative || 0)}
                                <Info className="size-3 text-muted-foreground/70" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
                              {i === 0 ? (
                                <>
                                  Cumulative = Year 0 Net Cash Flow = {fmtUnit(d.cumulative || 0)}
                                </>
                              ) : (
                                <>
                                  Cumulative = {fmtUnit(chartData[i - 1].cumulative || 0)} + {fmtUnit(d.cashFlow || 0)} = {fmtUnit(d.cumulative || 0)}
                                </>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetAll}
                  className="gap-2"
                >
                  <RotateCcw className="size-4" />
                  Reset
                </Button>
                <Button type="button" onClick={calculate} className="gap-2">
                  <Calculator className="size-4" />
                  Calculate
                </Button>
              </div>
            </div>
          </div>

          {/* Results panel */}
          <aside className="space-y-4 lg:sticky lg:top-6 self-start">
            <div className="flex items-center gap-3 px-1">
              <span className="h-6 w-1 rounded-full bg-gradient-to-b from-accent to-primary" />
              <h2 className="font-display text-xl font-semibold tracking-tight text-primary">
                Results
              </h2>
              <span className="ml-auto text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Investment Verdict
              </span>
            </div>
            {!showResults ? (
              <div className="rounded-2xl border border-primary/10 bg-card p-8 text-center">
                <Calculator className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Fill in the cash flows and click{" "}
                  <span className="font-medium text-foreground">Calculate</span>{" "}
                  to see the analysis.
                </p>
              </div>
            ) : (
              <>
                {/* MIRR hero card — primary decision metric */}
                <button
                  type="button"
                  onClick={() => setOpenMetric("mirr")}
                  className={`relative w-full overflow-hidden rounded-2xl border-2 p-7 text-left shadow-xl ring-4 ring-offset-2 ring-offset-background transition hover:scale-[1.01] hover:shadow-2xl ${
                    mirrValue == null
                      ? "bg-primary text-primary-foreground ring-primary/30 border-primary"
                      : mirrValue >= hurdleRate
                        ? "bg-success text-success-foreground ring-success/40 border-success"
                        : "bg-destructive text-destructive-foreground ring-destructive/40 border-destructive"
                  }`}
                >
                  <span className="absolute right-4 top-4 rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm">
                    Primary Metric
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest opacity-90">
                    Modified IRR (MIRR) <Info className="size-3.5" />
                  </div>
                  <div className="mt-2 font-display text-6xl font-bold tracking-tight">
                    {mirrValue == null
                      ? "—"
                      : `${(mirrValue * 100).toFixed(2)}%`}
                  </div>
                  <div className="mt-2 text-sm opacity-90">
                    Key indicator for investment decision · Finance &amp; reinvestment at WACC · click to see steps
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
                    label={`Discounted Payback @ ${(wacc * 100).toFixed(1)}%`}
                    value={
                      discountedPayback == null
                        ? "Not recovered"
                        : `${discountedPayback.toFixed(2)} yrs`
                    }
                    subtitle="Time-value adjusted recovery"
                    onClick={() => setOpenMetric("payback")}
                  />
                  <MetricCard
                    label="Annual Net CF"
                    value={fmtUnit(annualNet || 0)}
                    subtitle="CFAT + Depreciation (Y1)"
                    positive={annualNet >= 0}
                  />
                </div>

                <div className="rounded-2xl border bg-card p-5 text-sm">
                  <Row label="Project" value={projectName} />
                  <Row
                    label="Project Type"
                    value={projectType === "new" ? "New Project" : "Existing Project"}
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
            discountedPayback,
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

function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4 border-b border-primary/10 pb-3">
      <div className="flex items-start gap-3 min-w-0">
        <span className="mt-1 h-6 w-1 rounded-full bg-gradient-to-b from-accent to-primary shrink-0" />
        <div className="min-w-0">
          <h2 className="font-display text-xl md:text-[1.35rem] font-semibold tracking-tight text-primary">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
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
  discountedPayback: number | null;
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
    mirr: "MIRR - Modified Internal Rate of Return",
    irr: "IRR - Internal Rate of Return",
    npv: "NPV - Net Present Value",
    payback: "Payback Period",
    decision: "Investment Recommendation",
  };

  return (
    <Dialog open={open !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Calculation Breakdown
          </div>
          <DialogTitle className="font-display text-xl text-primary">
            {open && titleMap[open]}
          </DialogTitle>
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
  const { cashFlows, payback, discountedPayback, wacc } = ctx;
  let cum = 0;
  let dcum = 0;
  const rows = cashFlows.map((cf, i) => {
    const df = 1 / Math.pow(1 + wacc, i);
    const dcf = cf * df;
    cum += cf;
    dcum += dcf;
    return `  Y${i}: CF=${ctx.fmt(cf)}  DF=${df.toFixed(4)}  DCF=${ctx.fmt(dcf)}  Cum=${ctx.fmt(cum)}  DiscCum=${ctx.fmt(dcum)}`;
  });
  return (
    <>
      <Section title="Formula — Non-discounted Payback">
        <Formula>{`Payback = year at which cumulative cash flow turns ≥ 0
(with linear interpolation within the year)`}</Formula>
      </Section>
      <Section title="Formula — Discounted Payback">
        <Formula>{`Discounted Payback = year at which Σ CFₜ / (1 + WACC)^t turns ≥ 0
WACC = ${(wacc * 100).toFixed(2)}%`}</Formula>
      </Section>
      <Section title="Substituted values">
        <Formula>
          {`${rows.join("\n")}

Non-discounted Payback = ${payback == null ? "Not recovered within horizon" : payback.toFixed(2) + " years"}
Discounted Payback     = ${discountedPayback == null ? "Not recovered within horizon" : discountedPayback.toFixed(2) + " years"}`}
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
