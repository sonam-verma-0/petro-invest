// MIRR calculation
// values: array of cash flows (index = year, 0..n)
// financeRate: rate for negative cash flows (cost of capital)
// reinvestRate: rate for positive cash flows (reinvestment rate)
export function mirr(values: number[], financeRate: number, reinvestRate: number): number | null {
  const n = values.length - 1;
  if (n < 1) return null;

  let pvNeg = 0;
  let fvPos = 0;

  values.forEach((v, i) => {
    if (v < 0) {
      pvNeg += v / Math.pow(1 + financeRate, i);
    } else if (v > 0) {
      fvPos += v * Math.pow(1 + reinvestRate, n - i);
    }
  });

  if (pvNeg === 0 || fvPos === 0) return null;

  const ratio = fvPos / -pvNeg;
  if (ratio <= 0) return null;
  return Math.pow(ratio, 1 / n) - 1;
}

export function npv(rate: number, values: number[]): number {
  return values.reduce((acc, v, i) => acc + v / Math.pow(1 + rate, i), 0);
}

export function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}
