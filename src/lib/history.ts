import type { CalcRecord } from "./report";

const KEY = "capitalLens.history.v1";

export function loadHistory(): CalcRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveHistory(items: CalcRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* ignore quota errors */
  }
}

export function addHistoryRecord(rec: CalcRecord): CalcRecord[] {
  const items = loadHistory();
  // newest first; cap to 50
  const next = [rec, ...items].slice(0, 50);
  saveHistory(next);
  return next;
}

export function deleteHistoryRecord(id: string): CalcRecord[] {
  const next = loadHistory().filter((r) => r.id !== id);
  saveHistory(next);
  return next;
}
