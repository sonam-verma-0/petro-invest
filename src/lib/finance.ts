// MIRR calculation
export function mirr(values: number[], financeRate: number, reinvestRate: number): number | null {
  const n = values.length - 1;
  if (n < 1) return null;
  let pvNeg = 0;
  let fvPos = 0;
  values.forEach((v, i) => {
    if (v < 0) pvNeg += v / Math.pow(1 + financeRate, i);
    else if (v > 0) fvPos += v * Math.pow(1 + reinvestRate, n - i);
  });
  if (pvNeg === 0 || fvPos === 0) return null;
  const ratio = fvPos / -pvNeg;
  if (ratio <= 0) return null;
  return Math.pow(ratio, 1 / n) - 1;
}

export function npv(rate: number, values: number[]): number {
  return values.reduce((acc, v, i) => acc + v / Math.pow(1 + rate, i), 0);
}

// IRR via bisection / Newton fallback
export function irr(values: number[], guess = 0.1): number | null {
  const hasNeg = values.some((v) => v < 0);
  const hasPos = values.some((v) => v > 0);
  if (!hasNeg || !hasPos) return null;

  // Bisection between -0.999 and 10
  let low = -0.999;
  let high = 10;
  let fLow = npv(low, values);
  let fHigh = npv(high, values);
  if (fLow * fHigh > 0) {
    // try expand
    for (let i = 0; i < 50 && fLow * fHigh > 0; i++) {
      high *= 2;
      fHigh = npv(high, values);
    }
    if (fLow * fHigh > 0) return null;
  }
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    const fMid = npv(mid, values);
    if (Math.abs(fMid) < 1e-7) return mid;
    if (fLow * fMid < 0) {
      high = mid;
      fHigh = fMid;
    } else {
      low = mid;
      fLow = fMid;
    }
  }
  return (low + high) / 2;
}

// Payback period in years (with fractional interpolation). Returns null if never recovered.
export function paybackPeriod(values: number[]): number | null {
  let cum = 0;
  for (let i = 0; i < values.length; i++) {
    const prev = cum;
    cum += values[i];
    if (cum >= 0 && prev < 0) {
      const needed = -prev;
      const frac = values[i] !== 0 ? needed / values[i] : 0;
      return (i - 1) + frac + 1 - 1 + frac; // simplification below
    }
  }
  // cleaner re-implementation
  cum = 0;
  for (let i = 0; i < values.length; i++) {
    const next = cum + values[i];
    if (next >= 0 && cum < 0) {
      return i - 1 + (-cum / values[i]);
    }
    cum = next;
  }
  return cum >= 0 ? values.length - 1 : null;
}

// Discounted payback period in years using rate r. Returns null if never recovered.
export function discountedPaybackPeriod(values: number[], r: number): number | null {
  const discounted = values.map((v, i) => v / Math.pow(1 + r, i));
  let cum = 0;
  for (let i = 0; i < discounted.length; i++) {
    const next = cum + discounted[i];
    if (next >= 0 && cum < 0) {
      return i - 1 + (-cum / discounted[i]);
    }
    cum = next;
  }
  return cum >= 0 ? discounted.length - 1 : null;
}

export function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}
