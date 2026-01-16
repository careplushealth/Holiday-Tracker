export function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isWeekend(date) {
  const day = date.getDay(); // 0 Sun, 6 Sat
  return day === 0 || day === 6;
}

export function eachDayInclusive(startISO, endISO) {
  const start = parseISO(startISO);
  const end = parseISO(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const dir = start <= end ? 1 : -1;
  const days = [];
  let cur = start;

  while ((dir === 1 && cur <= end) || (dir === -1 && cur >= end)) {
    days.push(toISODate(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + dir);
  }
  return days;
}

export function getYearFromISO(iso) {
  return Number(String(iso || "").slice(0, 4));
}

/**
 * Weekly hours object format:
 * {
 *   mon: 8, tue: 8, wed: 4, thu: 8, fri: 8, sat: 0, sun: 0
 * }
 */
export function getScheduledHoursForISO(iso, weeklyHours) {
  const dt = parseISO(iso);
  const dow = dt.getDay(); // 0 Sun ... 6 Sat
  const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const key = map[dow];
  const h = Number(weeklyHours?.[key] ?? 0);
  return Number.isFinite(h) ? h : 0;
}

/**
 * Calculates hours between start/end dates inclusive,
 * based on employee's scheduled hours per weekday,
 * excluding public holidays (0 hours on those days).
 */
export function calculateHours(startISO, endISO, weeklyHours, publicHolidayISOsSet) {
  const days = eachDayInclusive(startISO, endISO);
  let total = 0;

  for (const iso of days) {
    if (publicHolidayISOsSet?.has(iso)) continue;
    total += getScheduledHoursForISO(iso, weeklyHours);
  }

  // keep 2 decimals max (for 7.5 etc)
  return Math.round(total * 100) / 100;
}
