import React, { useMemo, useEffect, useState } from "react";
import { useStore } from "../context/Store.jsx";
import { useAuth } from "../context/Auth.jsx";
import { eachDayInclusive, getYearFromISO } from "../utils/dates.js";
import { calculateHours } from "../utils/dates.js";
import { calcPublicHolidayHoursForYear } from "../utils/holidayHours.js";

const TYPES = ["Holiday", "Sick Leave", "Other"];

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function BranchLeavePage() {
  const { state } = useStore(); // still used for branch name lookup
  const { session } = useAuth();

  const branchId = session?.branchId;

  const branchName =
    state.branches.find((b) => b.id === branchId)?.name || "Branch";

  const currentYear = new Date().getFullYear();

  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [publicHolidays, setPublicHolidays] = useState([]);

  const [employeeId, setEmployeeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [type, setType] = useState("Holiday");
  const [comment, setComment] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Use year from date inputs if set, otherwise current year
  const year = useMemo(() => {
    return getYearFromISO(startDate) || getYearFromISO(endDate) || currentYear;
  }, [startDate, endDate, currentYear]);

  // Load employees for this branch
  useEffect(() => {
    if (!branchId) return;
    (async () => {
      const res = await fetch(`${API}/employees?branchId=${branchId}`);
      const data = await res.json();
      setEmployees(Array.isArray(data) ? data : []);
    })();
  }, [branchId]);

  // Ensure selected employeeId stays valid
  useEffect(() => {
    if (!employees.length) {
      setEmployeeId("");
      return;
    }
    if (!employeeId) setEmployeeId(employees[0].id);
    else if (!employees.some((e) => e.id === employeeId)) setEmployeeId(employees[0].id);
  }, [employees, employeeId]);

  // Load public holidays for selected year
  useEffect(() => {
    (async () => {
      const res = await fetch(`${API}/public-holidays?year=${year}`);
      const data = await res.json();
      setPublicHolidays(Array.isArray(data) ? data : []);
    })();
  }, [year]);

  const publicHolidaySet = useMemo(() => {
    return new Set((publicHolidays || []).map((h) => h.date));
  }, [publicHolidays]);

  // Load leaves for the branch for whole selected year (simple)
  useEffect(() => {
    if (!branchId) return;
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    (async () => {
      const res = await fetch(`${API}/leaves?branchId=${branchId}&from=${from}&to=${to}`);
      const data = await res.json();
      setLeaves(Array.isArray(data) ? data : []);
    })();
  }, [branchId, year]);

  const employee = useMemo(
    () => employees.find((e) => e.id === employeeId),
    [employees, employeeId]
  );

  // Auto-calc leave HOURS for the selected employee using their weekly schedule
  const hours = useMemo(() => {
    if (!startDate || !endDate || !employee) return 0;
    return calculateHours(startDate, endDate, employee.weeklyHours, publicHolidaySet);
  }, [startDate, endDate, employee, publicHolidaySet]);

  // Leaves for selected employee (from API, single-day rows)
  const employeeLeaves = useMemo(() => {
    return leaves.filter((l) => l.employeeId === employeeId);
  }, [leaves, employeeId]);

  // Stats
  const stats = useMemo(() => {
    if (!employee) return null;

    let totalTaken = 0;
    let holidayTaken = 0;
    let sickTaken = 0;
    let otherTaken = 0;

    for (const l of employeeLeaves) {
      const h = Number(l.hours) || 0;
      totalTaken += h;

      if (l.type === "Holiday") holidayTaken += h;
      else if (l.type === "Sick Leave") sickTaken += h;
      else otherTaken += h;
    }

    const allowedHoliday = Number(employee.allowedHolidayHoursPerYear || 0);

    // Whole-year public holiday hours based on employee schedule
    const phYear = calcPublicHolidayHoursForYear(year, employee.weeklyHours, publicHolidays);

    const remainingHoliday = Math.max(0, allowedHoliday - holidayTaken - phYear);

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

  async function submit(e) {
    e.preventDefault();
    setSavedMsg("");

    if (!branchId || !employeeId || !startDate || !endDate || !employee) return;
    if (hours <= 0) return;

    setLoading(true);
    try {
      // Expand range into per-day rows, skipping non-working/public-holiday days
      const days = eachDayInclusive(startDate, endDate);

      const items = [];
      for (const iso of days) {
        if (publicHolidaySet.has(iso)) continue;

        const day = new Date(iso + "T00:00:00");
        const jsDay = day.getDay(); // 0 Sun ... 6 Sat
        const key =
          jsDay === 1 ? "mon" :
          jsDay === 2 ? "tue" :
          jsDay === 3 ? "wed" :
          jsDay === 4 ? "thu" :
          jsDay === 5 ? "fri" :
          jsDay === 6 ? "sat" : "sun";

        const h = Number(employee.weeklyHours?.[key] ?? 0);
        if (h <= 0) continue;

        items.push({
          employeeId,
          date: iso,
          hours: h,
          type,
          comment: comment.trim(),
        });
      }

      if (!items.length) {
        setSavedMsg("No working days selected (or all days were public holidays).");
        return;
      }

      const res = await fetch(`${API}/leaves/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, items }),
      });

      if (!res.ok) throw new Error(await res.text());

      // Refresh leaves
      const from = `${year}-01-01`;
      const to = `${year}-12-31`;
      const r2 = await fetch(`${API}/leaves?branchId=${branchId}&from=${from}&to=${to}`);
      const data = await r2.json();
      setLeaves(Array.isArray(data) ? data : []);

      setStartDate("");
      setEndDate("");
      setComment("");
      setSavedMsg("Leave saved successfully.");
    } catch (err) {
      console.error(err);
      setSavedMsg("Error saving leave. Check server logs.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="pageHeader">
        <h1 className="h1">Leave Entry</h1>
        <p className="muted">{branchName} • Branch access: add leave only.</p>
      </div>

      <div className="grid2">
        {/* LEFT: Form */}
        <div className="card">
          <div className="cardHeader">
            <h3 className="h3">New Leave</h3>
            <div className="muted">Hours auto-calculated</div>
          </div>

          {employees.length === 0 ? (
            <div className="notice">
              No employees set for this branch. Please contact admin to add employees.
            </div>
          ) : (
            <form className="form" onSubmit={submit}>
              <div className="formRow">
                <label className="label">Employee</label>
                <select
                  className="select"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>

                <div className="mutedSm">
                  Working pattern:{" "}
                  <b>
                    {employee
                      ? `Mon ${employee.weeklyHours?.mon ?? 0}h, Tue ${employee.weeklyHours?.tue ?? 0}h, Wed ${employee.weeklyHours?.wed ?? 0}h, Thu ${employee.weeklyHours?.thu ?? 0}h, Fri ${employee.weeklyHours?.fri ?? 0}h`
                      : "—"}
                  </b>
                </div>
              </div>

              <div className="formRow2">
                <div>
                  <label className="label">Start Date</label>
                  <input
                    className="input"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">End Date</label>
                  <input
                    className="input"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="formRow2">
                <div>
                  <label className="label">Type of Leave</label>
                  <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Hours (auto)</label>
                  <input className="input" value={round2(hours)} readOnly />
                </div>
              </div>

              <div className="formRow">
                <label className="label">Comment (optional)</label>
                <textarea
                  className="textarea"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="e.g. Dentist appointment, flu, family emergency..."
                />
              </div>

              {savedMsg && <div className="successBox">{savedMsg}</div>}

              <div className="formActions">
                <button
                  className="btn"
                  type="submit"
                  disabled={loading || !employeeId || !startDate || !endDate || hours <= 0}
                >
                  {loading ? "Saving..." : "Save Leave"}
                </button>
              </div>

              <div className="hint">
                Tip: Public holidays are managed by admin in the <b>Public Holidays</b> page.
              </div>
            </form>
          )}
        </div>

        {/* RIGHT: Stats */}
        <div className="statsCard">
          <h3 className="h3">Key Statistics {employee ? `(${employee.name})` : ""}</h3>

          {!stats ? (
            <div className="muted">Select an employee to see stats.</div>
          ) : (
            <>
              <div className="statsGrid">
                <Stat label="Holiday Allowed / Year (hrs)" value={round2(stats.allowedHoliday)} />
                <Stat label="Total Taken (hrs)" value={round2(stats.totalTaken)} />
                <Stat label="Holiday Taken (hrs)" value={round2(stats.holidayTaken)} />
                <Stat label="Sick Taken (hrs)" value={round2(stats.sickTaken)} />
                <Stat label="Other Taken (hrs)" value={round2(stats.otherTaken)} />
                <Stat label="Public Holidays (Year) (hrs)" value={round2(stats.phYear)} />
                <Stat label="Holiday Remaining (hrs)" value={round2(stats.remainingHoliday)} />
              </div>

              <div className="mutedSm" style={{ marginTop: 8 }}>
                Remaining = Allowed − Holiday Taken − Public Holidays (Year)
              </div>
            </>
          )}
        </div>
      </div>
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
console.log(import.meta.env.VITE_API_URL);
