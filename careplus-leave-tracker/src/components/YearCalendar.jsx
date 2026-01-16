import React, { useMemo } from "react";
import { parseISO, toISODate, isWeekend, getScheduledHoursForISO } from "../utils/dates.js";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export default function YearCalendar({ year, leaveDaysMap, publicHolidaySet, weeklyHours }) {
  const months = useMemo(() => {
    return Array.from({ length: 12 }).map((_, monthIndex) => buildMonth(year, monthIndex));
  }, [year]);

  return (
    <div className="yearCalendar">
      {months.map((m) => (
        <div className="monthCard" key={m.monthIndex}>
          <div className="monthTitle">{MONTHS[m.monthIndex]}</div>

          <div className="monthGrid">
            {WEEKDAYS.map((w) => (
              <div key={w} className="dowCell">{w}</div>
            ))}

            {m.cells.map((cell, idx) => {
              if (!cell) return <div key={idx} className="dayCell dayEmpty" />;

              const { iso, day } = cell;
              const leave = leaveDaysMap.get(iso); // { type, comment, hours }
              const weekend = isWeekend(parseISO(iso));
              const isPH = publicHolidaySet?.has(iso);

              const scheduledHours = weeklyHours ? getScheduledHoursForISO(iso, weeklyHours) : 0;

              const cls = [
                "dayCell",
                weekend ? "dayWeekend" : "",
                isPH ? "dayPublicHoliday" : "",
                leave ? leaveClass(leave.type) : "",
              ].filter(Boolean).join(" ");

              const titleParts = [];
              titleParts.push(iso);
              titleParts.push(`Scheduled: ${round2(scheduledHours)}h`);

              if (isPH) titleParts.push("Public Holiday");
              if (leave) {
                titleParts.push(`${leave.type}: ${round2(leave.hours)}h${leave.comment ? ` — ${leave.comment}` : ""}`);
              }

              return (
                <div key={iso} className={cls} title={titleParts.join("\n")}>
                  <span className="dayNum">{day}</span>
                </div>
              );
            })}
          </div>

          <div className="monthLegend">
            <span className="legendItem"><span className="legendSwatch swHoliday" /> Holiday</span>
            <span className="legendItem"><span className="legendSwatch swSick" /> Sick</span>
            <span className="legendItem"><span className="legendSwatch swOther" /> Other</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function leaveClass(type) {
  if (type === "Holiday") return "dayLeaveHoliday";
  if (type === "Sick Leave") return "dayLeaveSick";
  return "dayLeaveOther";
}

function buildMonth(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const startDow = first.getDay(); // 0-6
  const totalDays = last.getDate();

  const cells = Array(42).fill(null);

  for (let d = 1; d <= totalDays; d++) {
    const dt = new Date(year, monthIndex, d);
    const iso = toISODate(dt);
    const pos = startDow + (d - 1);
    cells[pos] = { day: d, iso };
  }

  return { year, monthIndex, cells };
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
