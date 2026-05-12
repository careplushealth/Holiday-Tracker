import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../context/Store.jsx";
import { calculateHours, getYearFromISO } from "../utils/dates.js";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

// Backend types (server expects: ANNUAL / SICK / UNPAID / OTHER)
const TYPE_OPTIONS = [
  { label: "Holiday", value: "ANNUAL" },
  { label: "Sick Leave", value: "SICK" },
  { label: "Unpaid", value: "UNPAID" },
  { label: "Other", value: "OTHER" },
];

export default function LeaveEntryPage() {
  const { state } = useStore();
  const branchId = state.activeBranchId;

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [employeeId, setEmployeeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [type, setType] = useState("ANNUAL");
  const [comment, setComment] = useState("");
  const [displayHours, setDisplayHours] = useState(0);

  // Determine relevant year (for holidays + leaves range)
  const year = useMemo(() => {
    const y = getYearFromISO(startDate) || getYearFromISO(endDate) || new Date().getFullYear();
    return y || new Date().getFullYear();
  }, [startDate, endDate]);

  // Public holidays set (supports either ["YYYY-MM-DD"] or [{date,name}])
  const publicHolidaySet = useMemo(() => {
    const list = state.publicHolidaysByYear?.[year] || [];
    const dates = list.map((h) => (typeof h === "string" ? h : h?.date)).filter(Boolean);
    return new Set(dates);
  }, [state.publicHolidaysByYear, year]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === employeeId),
    [employees, employeeId]
  );

  const hours = useMemo(() => {
    if (!startDate || !endDate || !selectedEmployee) return 0;
    return calculateHours(startDate, endDate, selectedEmployee.weeklyHours, publicHolidaySet);
  }, [startDate, endDate, selectedEmployee, publicHolidaySet]);

  // Sync displayHours whenever auto-calc changes (e.g. date or employee changes)
  // User can still override by typing in the input
  useEffect(() => {
    setDisplayHours(hours);
  }, [hours]);

  // Load employees whenever branchId or year changes
  useEffect(() => {
    // IMPORTANT: still a hook, runs every render, but exits early safely
    if (!branchId) {
      setEmployees([]);
      setEmployeeId("");
      return;
    }

    (async () => {
      setLoading(true);
      setMsg("");
      try {
        const eRes = await fetch(`${API}/employees?branchId=${encodeURIComponent(branchId)}`);
        const eData = await eRes.json();
        const emps = Array.isArray(eData) ? eData : [];

        setEmployees(emps);

        // Ensure a valid selected employee
        if (emps.length > 0) {
          setEmployeeId((prev) => (prev && emps.some((x) => x.id === prev) ? prev : emps[0].id));
        } else {
          setEmployeeId("");
        }
      } catch (err) {
        console.error(err);
        setEmployees([]);
        setEmployeeId("");
        setMsg("Failed to load employees. Check server.");
      } finally {
        setLoading(false);
      }
    })();
  }, [branchId, year]);

  async function submit(e) {
    e.preventDefault();
    if (!branchId) {
      setMsg("Select a branch first.");
      return;
    }
    const finalHours = Number(displayHours) || 0;
    if (!employeeId || !startDate || !endDate || finalHours <= 0) return;
    if (startDate > endDate) {
      setMsg("End date must be after start date.");
      return;
    }

    setLoading(true);
    setMsg("");

    try {
      // ✅ NEW: store ONE record with start/end range
      const payload = {
        branchId,
        employeeId,
        startDate,
        endDate,
        hours: Number(displayHours) || 0,
        type,
        comment: comment.trim(),
      };

      const res = await fetch(`${API}/leaves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      setStartDate("");
      setEndDate("");
      setComment("");
      setDisplayHours(0);
      setMsg("Leave saved.");
    } catch (err) {
      console.error(err);
      setMsg("Error saving leave. Check server logs.");
    } finally {
      setLoading(false);
    }
  }

  // ✅ Render (NO early return before hooks)
  const needsBranch = !branchId;

  return (
    <div className="page" style={{ textAlign: "center" }}>
      <div className="pageHeader">
        <h1 className="h1">Leave Entry</h1>
        <p className="muted">
          Add leave for an employee. Hours are auto-calculated based on that employee’s weekly working pattern
          (public holidays excluded).
        </p>
      </div>

      {needsBranch ? (
        <div className="card" style={{ maxWidth: 600, margin: "0 auto" }}>
          <div className="notice">Select a branch first (top left) to start adding leave.</div>
        </div>
      ) : (
        <>
          <div className="card" style={{ maxWidth: 1000, margin: "0 auto", textAlign: "left" }}>
            <div className="cardHeader">
              <h3 className="h3">New Leave</h3>
              <div className="muted">Branch-specific</div>
            </div>

            {employees.length === 0 ? (
              <div className="notice">
                No employees in this branch yet. Go to <b>Employees</b> to add one.
              </div>
            ) : (
              <form className="form" onSubmit={submit}>
                <div className="formRow">
                  <label className="label">Employee</label>
                  <select
                    className="select"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    disabled={loading}
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>

                  <div className="mutedSm">
                    Weekly hours used for calculation:{" "}
                    <b>
                      {selectedEmployee
                        ? `${selectedEmployee.weeklyHours?.mon ?? 0}/${selectedEmployee.weeklyHours?.tue ?? 0}/${selectedEmployee.weeklyHours?.wed ?? 0}/${selectedEmployee.weeklyHours?.thu ?? 0}/${selectedEmployee.weeklyHours?.fri ?? 0} (Mon–Fri)`
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
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="label">End Date</label>
                    <input
                      className="input"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="formRow2">
                  <div>
                    <label className="label">Type of Leave</label>
                    <select
                      className="select"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      disabled={loading}
                    >
                      {TYPE_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Hours</label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.5"
                      value={displayHours}
                      onChange={(e) => setDisplayHours(e.target.value)}
                      disabled={loading}
                    />
                    <div className="mutedSm">Auto-calculated. Edit for half-days or custom hours.</div>
                  </div>
                </div>

                <div className="formRow">
                  <label className="label">Comment (optional)</label>
                  <textarea
                    className="textarea"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="e.g. Dentist appointment, flu, family emergency..."
                    rows={3}
                    disabled={loading}
                  />
                </div>

                <div className="formActions">
                  <button
                    className="btn"
                    type="submit"
                    disabled={loading || !employeeId || !startDate || !endDate || (Number(displayHours) || 0) <= 0}
                  >
                    {loading ? "Saving..." : "Save Leave"}
                  </button>
                </div>

                <div className="hint">
                  Tip: Public holidays are managed on the <b>Public Holidays</b> page.
                </div>

                {msg && <div className="mutedSm" style={{ marginTop: 8 }}>{msg}</div>}
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
