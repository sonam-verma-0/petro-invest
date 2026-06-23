import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type CalcRecord = {
  id: string;
  timestamp: number;
  projectName: string;
  projectType: "new" | "existing";
  years: number;
  unit: "cr" | "lakh" | "rupee";
  inputs: {
    capex: number;
    salesMode: "constant" | "yearwise";
    annualSales: number;
    annualNfr: number;
    annualRevenueExp: number;
    annualDepreciation: number;
    annualTaxRatePct: number;
    yearlySales: number[];
    yearlyNfr: number[];
    yearlyRevExp: number[];
    yearlyDepreciation: number[];
    yearlyTaxRatePct: number[];
    waccPct: number;
    financeRatePct: number;
    reinvestRatePct: number;
    hurdleRatePct: number;
  };
  results: {
    npv: number | null;
    irr: number | null;
    mirr: number | null;
    payback: number | null;
    discountedPayback: number | null;
    profitabilityIndex: number | null;
    verdict: "INVEST" | "REJECT" | "ANALYZE";
    verdictReason: string;
  };
  cashflow: { year: string; cashFlow: number; cumulative: number }[];
};

export function unitSuffix(u: CalcRecord["unit"]) {
  return u === "cr" ? "₹ Cr" : u === "lakh" ? "₹ Lakh" : "₹";
}

export function formatTs(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtRupeeForUnit(v: number | null, unit: CalcRecord["unit"]) {
  if (v == null || !isFinite(v)) return "—";
  const mult = unit === "cr" ? 1e7 : unit === "lakh" ? 1e5 : 1;
  const scaled = v / mult;
  const suffix = unit === "cr" ? " Cr" : unit === "lakh" ? " L" : "";
  return `Rs ${scaled.toLocaleString("en-IN", { maximumFractionDigits: 2 })}${suffix}`;
}

function fmtPct(v: number | null) {
  if (v == null || !isFinite(v)) return "—";
  return `${(v * 100).toFixed(2)}%`;
}

export function generatePdf(r: CalcRecord) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 40;
  let y = M;

  // Brand header bar
  doc.setFillColor(0, 51, 102);
  doc.rect(0, 0, pageW, 60, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("CAPITAL LENS", M, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Capital Budgeting & Investment Evaluator", M, 48);
  doc.setFontSize(9);
  doc.text(`Generated: ${formatTs(Date.now())}`, pageW - M, 32, { align: "right" });
  doc.text("In collaboration with Indian Oil Corporation Ltd.", pageW - M, 48, {
    align: "right",
  });

  y = 90;
  doc.setTextColor(20, 20, 20);

  const section = (title: string) => {
    if (y > 760) { doc.addPage(); y = M; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(0, 51, 102);
    doc.text(title, M, y);
    doc.setDrawColor(0, 51, 102);
    doc.setLineWidth(0.8);
    doc.line(M, y + 4, pageW - M, y + 4);
    y += 16;
    doc.setTextColor(20, 20, 20);
  };

  // 1. Project Info
  section("Project Information");
  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 180 } },
    body: [
      ["Project Name", r.projectName],
      ["Project Type", r.projectType === "new" ? "New Project" : "Existing Project"],
      ["Date & Time", formatTs(r.timestamp)],
      ["Evaluation Horizon", `${r.years} year${r.years > 1 ? "s" : ""}`],
      ["Display Unit", unitSuffix(r.unit)],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 20;

  // 2. Input parameters
  section("Input Parameters");
  const u = unitSuffix(r.unit);
  const i = r.inputs;
  autoTable(doc, {
    startY: y,
    theme: "striped",
    headStyles: { fillColor: [0, 51, 102] },
    styles: { fontSize: 10 },
    head: [["Parameter", "Value"]],
    body: [
      ["Capex (Year 0)", `${i.capex} ${u}`],
      ["Sales Mode", i.salesMode === "constant" ? "Constant" : "Year-wise"],
      ...(i.salesMode === "constant"
        ? [
            ["Annual Project Sales", `${i.annualSales} ${u}`],
            ["Annual NFR Income", `${i.annualNfr} ${u}`],
            ["Annual Revenue Expenditure", `${i.annualRevenueExp} ${u}`],
            ["Annual Depreciation", `${i.annualDepreciation} ${u}`],
            ["Income Tax Rate", `${i.annualTaxRatePct}%`],
          ]
        : []),
      ["Discount Rate (WACC)", `${i.waccPct}%`],
      
      ["Reinvestment Rate", `${i.reinvestRatePct}%`],
      ["Hurdle Rate", `${i.hurdleRatePct}%`],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  if (i.salesMode === "yearwise") {
    section("Year-wise Inputs");
    const head = [["Year", `Sales (${u})`, `NFR (${u})`, `Rev Exp (${u})`, `Depr (${u})`, "Tax %"]];
    const body = Array.from({ length: r.years }, (_, k) => [
      `Y${k + 1}`,
      String(i.yearlySales[k] ?? 0),
      String(i.yearlyNfr[k] ?? 0),
      String(i.yearlyRevExp[k] ?? 0),
      String(i.yearlyDepreciation[k] ?? 0),
      `${i.yearlyTaxRatePct[k] ?? 0}%`,
    ]);
    autoTable(doc, {
      startY: y,
      theme: "striped",
      headStyles: { fillColor: [0, 51, 102] },
      styles: { fontSize: 9 },
      head,
      body,
    });
    y = (doc as any).lastAutoTable.finalY + 16;
  }

  // 3. Investment Results
  section("Investment Results");
  const res = r.results;
  autoTable(doc, {
    startY: y,
    theme: "grid",
    headStyles: { fillColor: [0, 51, 102] },
    styles: { fontSize: 10 },
    head: [["Metric", "Value"]],
    body: [
      ["Net Present Value (NPV)", fmtRupeeForUnit(res.npv, r.unit)],
      ["Internal Rate of Return (IRR)", fmtPct(res.irr)],
      ["Modified IRR (MIRR)", fmtPct(res.mirr)],
      ["Payback Period", res.payback == null ? "Not recovered" : `${res.payback.toFixed(2)} yrs`],
      [
        "Discounted Payback Period",
        res.discountedPayback == null ? "Not recovered" : `${res.discountedPayback.toFixed(2)} yrs`,
      ],
      [
        "Profitability Index",
        res.profitabilityIndex == null ? "—" : res.profitabilityIndex.toFixed(3),
      ],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 14;

  // Verdict box
  if (y > 720) { doc.addPage(); y = M; }
  const verdictColor: [number, number, number] =
    res.verdict === "INVEST" ? [22, 130, 78] : res.verdict === "REJECT" ? [192, 41, 41] : [200, 130, 20];
  doc.setFillColor(...verdictColor);
  doc.roundedRect(M, y, pageW - M * 2, 50, 6, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("INVESTMENT VERDICT", M + 14, y + 18);
  doc.setFontSize(18);
  doc.text(res.verdict, M + 14, y + 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(res.verdictReason, pageW - M - 14, y + 30, { align: "right" });
  y += 70;
  doc.setTextColor(20, 20, 20);

  // 4. Cash Flow Summary
  section("Cash Flow Summary");
  autoTable(doc, {
    startY: y,
    theme: "striped",
    headStyles: { fillColor: [0, 51, 102] },
    styles: { fontSize: 10 },
    head: [["Year", "Net Cash Flow", "Cumulative Cash Flow"]],
    body: r.cashflow.map((d) => [
      d.year,
      fmtRupeeForUnit(d.cashFlow, r.unit),
      fmtRupeeForUnit(d.cumulative, r.unit),
    ]),
  });

  // Footer on each page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Capital Lens — Investment Report  •  ${r.projectName}  •  Page ${p} of ${pages}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 16,
      { align: "center" },
    );
  }

  const safeName = r.projectName.replace(/[^a-z0-9-_]+/gi, "_");
  doc.save(`CapitalLens_${safeName}_${new Date(r.timestamp).toISOString().slice(0, 10)}.pdf`);
}
