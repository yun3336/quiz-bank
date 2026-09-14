import { dayKey, shiftDay } from "./wrongBook";

export type HeatCell = {
  key: string;
  count: number;
  weekday: number;
  future: boolean;
};

export function heatLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

export function buildHeatmap(attempts: { at: number }[], now = Date.now(), weeks = 12): HeatCell[] {
  const today = dayKey(now);
  const weekdayToday = new Date(now).getDay();
  const start = shiftDay(today, -weekdayToday - (weeks - 1) * 7);
  const counts = new Map<string, number>();
  for (const item of attempts) {
    const key = dayKey(item.at);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const cells: HeatCell[] = [];
  for (let index = 0; index < weeks * 7; index += 1) {
    const key = shiftDay(start, index);
    cells.push({
      key,
      count: counts.get(key) ?? 0,
      weekday: index % 7,
      future: key > today,
    });
  }
  return cells;
}

export function heatLabel(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  return `${year}/${month}/${day}`;
}
