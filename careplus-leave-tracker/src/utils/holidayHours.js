import { getScheduledHoursForISO } from "./dates.js";

/**
 * publicHolidays: [{date, name}, ...]
 * Returns total public holiday hours for the whole year (not just passed dates),
 * based on employee weekly schedule.
 */
export function calcPublicHolidayHoursForYear(year, employeeWeeklyHours, publicHolidays) {
  let total = 0;

  for (const h of publicHolidays || []) {
    if (!h?.date) continue;
    if (String(h.date).slice(0, 4) !== String(year)) continue;

    total += getScheduledHoursForISO(h.date, employeeWeeklyHours);
  }

  return Math.round(total * 100) / 100;
}
