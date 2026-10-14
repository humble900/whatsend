export interface SendingWindow { start: string; end: string }
export function isWithinSendingWindow(windows: SendingWindow[], timeZone: string, now = new Date()) {
  if (!windows.length) return true;
  const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  return windows.some(({ start, end }) => start <= end ? hhmm >= start && hhmm < end : hhmm >= start || hhmm < end);
}
export function nextSendingWindow(windows: SendingWindow[], timeZone: string, now = new Date()) {
  for (let minutes = 1; minutes <= 2881; minutes++) { const candidate = new Date(now.getTime() + minutes * 60000); if (isWithinSendingWindow(windows, timeZone, candidate)) return candidate.getTime(); }
  return now.getTime() + 86400000;
}
export function campaignPacingMs(mode: string, min: number, max: number) { const lower = mode === "custom" ? min : 15; const upper = mode === "custom" ? max : 45; return Math.round((lower + Math.random() * (upper - lower)) * 1000); }
