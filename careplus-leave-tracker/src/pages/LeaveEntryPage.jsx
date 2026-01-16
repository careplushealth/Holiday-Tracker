import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../context/Store.jsx";
import { calculateHours, getYearFromISO } from "../utils/dates.js";
import LeaveTable from "../components/LeaveTable.jsx";

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
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [employeeId, setEmployeeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [type, setType] = useState("ANNUAL");
  const [comment, setComment] = useState("");

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

  const employeesById = useMemo(() => {
    const map = {};
    for (const e of employees) map[e.id] = e;
    return map;
  }, [employees]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === employeeId),
    [employees, employeeId]
  );

  const hours = useMemo(() => {
    if (!startDate || !endDate || !selectedEmployee) return 0;
    return calculateHours(startDate, endDate, selectedEmployee.weeklyHours, publicHolidaySet);
  }, [startDate, endDate, selectedEmployee, publicHolidaySet]);

  // Load employees + leaves whenever branchId or year changes
  useEffect(() => {
    // IMPORTANT: still a hook, runs every render, but exits early safely
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
          fetch(`${API}/employees?branchId=${encodeURIComponent(branchId)}`),
          fetch(`${API}/leaves?branchId=${encodeURIComponent(branchId)}&from=${from}&to=${to}`),
        ]);

        const eData = await eRes.json();
        const lData = await lRes.json();

        const emps = Array.isArray(eData) ? eData : [];
        const lvs = Array.isArray(lData) ? lData : [];

        setEmployees(emps);
        setLeaves(lvs);

        // Ensure a valid selected employee
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

  async function refreshLeaves() {
    if (!branchId) return;

    const from = `${year}-01-01`;
    const to = `${year}-12-31`;

    const res = await fetch(
      `${API}/leaves?branchId=${encodeURIComponent(branchId)}&from=${from}&to=${to}`
    );
    const data = await res.json();
    setLeaves(Array.isArray(data) ? data : []);
  }

  async function submit(e) {
    e.preventDefault();
    if (!branchId) {
      setMsg("Select a branch first.");
      return;
    }
    if (!employeeId || !startDate || !endDate || hours <= 0) return;

    setLoading(true);
    setMsg("");

    try {
      // NOTE: backend currently stores one row per day via /leaves/bulk.
      // For now we submit a single row on startDate with computed hours.
      // If you want real multi-day expansion, we can add it next.
      const payload = {
        branchId,
        items: [
          {
            employeeId,
            date: startDate,
            hours,
            type,
            comment: comment.trim(),
          },
        ],
      };

      const res = await fetch(`${API}/leaves/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      setStartDate("");
      setEndDate("");
      setComment("");
      setMsg("Leave saved.");
      await refreshLeaves();
    } catch (err) {
      console.error(err);
      setMsg("Error saving leave. Check server logs.");
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteLeave(_leaveId) {
    // Server has no DELETE endpoint for leaves yet.
    setMsg("Delete leave isn’t enabled yet (no server endpoint).");
  }

  const quickStats = useMemo(() => {
    const totalRecords = leaves.length;
    const totalHours = sum(leaves.map((l) => Number(l.hours) || 0));
    const holidayHours = sum(leaves.filter((l) => l.type === "ANNUAL").map((l) => Number(l.hours) || 0));
    const sickHours = sum(leaves.filter((l) => l.type === "SICK").map((l) => Number(l.hours) || 0));
    return { totalRecords, totalHours, holidayHours, sickHours };
  }, [leaves]);

  // ✅ Render (NO early return before hooks)
  const needsBranch = !branchId;

  return (
    <div className="page">
      <div className="pageHeader">
        <h1 className="h1">Leave Entry</h1>
        <p className="muted">
          Add leave for an employee. Hours are auto-calculated based on that employee’s weekly working pattern
          (public holidays excluded).
        </p>
      </div>

      {needsBranch ? (
        <div className="card">
          <div className="notice">Select a branch first (top left) to start adding leave.</div>
        </div>
      ) : (
        <>
          <div className="grid2">
            <div className="card">
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
                      placeholder="e.g. Dentist appointment, flu, family emergency..."
                      rows={3}
                      disabled={loading}
                    />
                  </div>

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
                    Tip: Public holidays are managed on the <b>Public Holidays</b> page.
                  </div>

                  {msg && <div className="mutedSm" style={{ marginTop: 8 }}>{msg}</div>}
                </form>
              )}
            </div>

            <div className="statsCard">
              <h3 className="h3">Quick Stats (Branch)</h3>
              <div className="statsGrid">
                <Stat label="Total Records" value={quickStats.totalRecords} />
                <Stat label="Total Hours (All Types)" value={round2(quickStats.totalHours)} />
                <Stat label="Holiday Hours" value={round2(quickStats.holidayHours)} />
                <Stat label="Sick Hours" value={round2(quickStats.sickHours)} />
              </div>
              <div className="mutedSm">Counts are based on saved records in the selected branch (current year).</div>
            </div>
          </div>

          <LeaveTable
            leaves={leaves}
            employeesById={employeesById}
            onDelete={onDeleteLeave}
            unitLabel="hours"
            valueKey="hours"
          />
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

function sum(nums) {
  return nums.reduce((a, b) => a + (Number(b) || 0), 0);
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
