import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../context/Store.jsx";
import YearCalendar from "../components/YearCalendar.jsx";
import { calcPublicHolidayHoursForYear } from "../utils/holidayHours.js";
import { eachDayInclusive } from "../utils/dates.js";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

function authHeaders(extra = {}) {
  let token = "";
  try {
    const raw = localStorage.getItem("careplus_auth_v1");
    const session = raw ? JSON.parse(raw) : null;
    token = session?.token || "";
  } catch {
    token = "";
  }

  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function CalendarPage() {
  const { state } = useStore();
  const branchId = state.activeBranchId;

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);

  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Public holidays list for selected year (supports either ["YYYY-MM-DD"] or [{date,name}])
  const publicHolidays = useMemo(() => {
    const list = state.publicHolidaysByYear?.[year] || [];
    return (list || [])
      .map((item) => {
        if (typeof item === "string") return { date: item, name: "Public Holiday" };
        if (item && typeof item === "object") return { date: item.date, name: item.name || "Public Holiday" };
        return null;
      })
      .filter((h) => h && typeof h.date === "string" && h.date.length >= 10);
  }, [state.publicHolidaysByYear, year]);

  const publicHolidaySet = useMemo(() => new Set(publicHolidays.map((h) => h.date)), [publicHolidays]);

  // Load employees + leaves for the selected branch + year
  useEffect(() => {
    if (!branchId) {
      setEmployees([]);
      setLeaves([]);
      setEmployeeId("");
      return;
    }

    const from = `${year}-01-01`;
    const to = `${year}-12-31`;

    (async () => {
      setLoading(true);
      setMsg("");
      try {
        const [eRes, lRes] = await Promise.all([
          fetch(`${API}/employees?branchId=${encodeURIComponent(branchId)}`, { headers: authHeaders() }),
          fetch(`${API}/leaves?branchId=${encodeURIComponent(branchId)}&from=${from}&to=${to}`, { headers: authHeaders() }),
        ]);

        const eData = await eRes.json();
        const lData = await lRes.json();

        const emps = Array.isArray(eData) ? eData : [];
        const lvs = Array.isArray(lData) ? lData : [];

        setEmployees(emps);
        setLeaves(lvs);

        // Ensure employee selection is always valid
        if (emps.length > 0) {
          setEmployeeId((prev) => (prev && emps.some((x) => x.id === prev) ? prev : emps[0].id));
        } else {
          setEmployeeId("");
        }
      } catch (err) {
        console.error(err);
        setEmployees([]);
        setLeaves([]);
        setEmployeeId("");
        setMsg("Failed to load employees/leaves. Check server.");
      } finally {
        setLoading(false);
      }
    })();
  }, [branchId, year]);

  const employee = useMemo(() => employees.find((e) => e.id === employeeId) || null, [employees, employeeId]);

  // Leaves are returned as ranges: startDate/endDate (YYYY-MM-DD)
  // We expand ranges into per-day markings so the calendar can colour each date.
  const employeeLeaves = useMemo(() => {
    if (!employeeId) return [];
    return leaves.filter((l) => l.employeeId === employeeId);
  }, [leaves, employeeId]);

  const leaveDaysMap = useMemo(() => {
    const map = new Map();

    for (const l of employeeLeaves) {
      const start = l?.startDate || l?.date;
      const end = l?.endDate || l?.date;
      if (!start || !end) continue;

      const days = eachDayInclusive(start, end);

      // Distribute total hours across the days (calendar just needs *some* hours for tooltip)
      const totalHours = Number(l.hours) || 0;
      const perDayHours = days.length ? totalHours / days.length : totalHours;

      for (const iso of days) {
        map.set(iso, {
          type: l.type,
          comment: l.comment || "",
          hours: perDayHours,
        });
      }
    }

    return map;
  }, [employeeLeaves]);

  const stats = useMemo(() => {
    if (!employee) return null;

    let totalTaken = 0;
    let holidayTaken = 0;
    let sickTaken = 0;
    let otherTaken = 0;

    for (const l of employeeLeaves) {
      const h = Number(l.hours) || 0;
      totalTaken += h;

      if (l.type === "ANNUAL") holidayTaken += h;
      else if (l.type === "SICK") sickTaken += h;
      else otherTaken += h;
    }

    const allowedHoliday = Number(employee.allowedHolidayHoursPerYear || 0);

    // Whole-year public holiday hours based on employee schedule
    const phYear = calcPublicHolidayHoursForYear(year, employee.weeklyHours, publicHolidays);

    // Remaining holiday = allowed - annual taken - public holidays deduction
    const remainingHoliday = Math.max(0, allowedHoliday - totalTaken - phYear);

    return {
      allowedHoliday,
      totalTaken,
      holidayTaken,
      sickTaken,
      otherTaken,
      phYear,
      remainingHoliday,
    };
  }, [employee, employeeLeaves, year, publicHolidays]);

  const needsBranch = !branchId;

  return (
    <div className="page">
      <div className="pageHeader">
        <h1 className="h1">Calendar View</h1>
        <p className="muted">
          Select an employee and see all leave marked on the full-year calendar. Hover a date to see scheduled hours.
        </p>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="tool">
            <label className="labelSm">Year</label>
            <input
              className="input"
              type="number"
              min="2000"
              max="2100"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || currentYear)}
            />
          </div>

          <div className="tool">
            <label className="labelSm">Employee</label>
            <select
              className="select"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={needsBranch || employees.length === 0 || loading}
            >
              {employees.length === 0 ? (
                <option value="">No employees</option>
              ) : (
                employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="tool toolGrow">
            <div className="mutedSm">Tooltip shows: scheduled hours + leave hours + comment (if any).</div>
          </div>
        </div>
      </div>

      {msg && <div className="notice">{msg}</div>}

      {needsBranch ? (
        <div className="notice">Select a branch first (top left).</div>
      ) : employees.length === 0 ? (
        <div className="notice">No employees yet. Add employees first.</div>
      ) : (
        <>
          <YearCalendar
            year={year}
            leaveDaysMap={leaveDaysMap}
            publicHolidaySet={publicHolidaySet}
            weeklyHours={employee?.weeklyHours}
          />

          <div className="card statsBottom">
            <h3 className="h3">Key Statistics ({employee?.name || "Employee"})</h3>

            {!stats ? (
              <div className="muted">Select an employee.</div>
            ) : (
              <div className="statsGrid">
                <Stat label="Holiday Allowed / Year (hrs)" value={round2(stats.allowedHoliday)} />
                <Stat label="Total Taken (hrs)" value={round2(stats.totalTaken)} />
                <Stat label="Holiday Taken (hrs)" value={round2(stats.holidayTaken)} />
                <Stat label="Sick Taken (hrs)" value={round2(stats.sickTaken)} />
                <Stat label="Other Taken (hrs)" value={round2(stats.otherTaken)} />
                <Stat label="Public Holidays (Year) (hrs)" value={round2(stats.phYear)} />
                <Stat label="Holiday Remaining (hrs)" value={round2(stats.remainingHoliday)} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="statBox">
      <div className="statLabel">{label}</div>
      <div className="statValue">{value}</div>
    </div>
  );
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
