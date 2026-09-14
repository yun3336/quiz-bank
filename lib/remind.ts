export const DEFAULT_REMIND_HOUR = 20;
export const REMIND_HOURS = [8, 12, 18, 20, 21] as const;
export type RemindHour = (typeof REMIND_HOURS)[number];

export type RemindPref = {
  enabled: boolean;
  hour: RemindHour;
};

export function parseRemindPref(raw: unknown): RemindPref {
  if (!raw || typeof raw !== "object") return { enabled: false, hour: DEFAULT_REMIND_HOUR };
  const data = raw as { enabled?: unknown; hour?: unknown };
  return {
    enabled: data.enabled === true,
    hour: parseRemindHour(data.hour),
  };
}

export function parseRemindHour(value: unknown): RemindHour {
  const n = typeof value === "number" ? value : Number(value);
  return REMIND_HOURS.includes(n as RemindHour) ? (n as RemindHour) : DEFAULT_REMIND_HOUR;
}

export function nextRemindAt(hour: number, now = Date.now()): number {
  const date = new Date(now);
  const fire = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0, 0);
  if (fire.getTime() <= now) fire.setDate(fire.getDate() + 1);
  return fire.getTime();
}

