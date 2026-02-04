import React, { useMemo, useEffect, useState } from "react";
import { useStore } from "../context/Store.jsx";
import { calcPublicHolidayHoursForYear } from "../utils/holidayHours.js";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

const DEFAULT_WEEK_STR = {
  mon: "8",
  tue: "8",
  wed: "8",
  thu: "8",
  fri: "8",
  sat: "0",
  sun: "0",
};

// Reads JWT from the same localStorage key used by Auth.jsx
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

export default function EmployeesPage() {
  const { state } = useStore();
  const branchId = state.activeBranchId;

  const year = new Date().getFullYear();

  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [publicHolidays, setPublicHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Add form
  const [name, setName] = useState("");
  const [allowedHolidayHoursPerYear, setAllowedHolidayHoursPerYear] = useState("224");
  const [weeklyHours, setWeeklyHours] = useState({ ...DEFAULT_WEEK_STR });

  // Edit form
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  // Load employees
  useEffect(() => {
    if (!branchId) return;
    (async () => {
      try {
        const res = await fetch(`${API}/employees?branchId=${branchId}`, {
          headers: authHeaders(),
        });
        const data = await res.json().catch(() => null);
        setEmployees(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setEmployees([]);
      }
    })();
  }, [branchId]);

  // Load public holidays for year
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/public-holidays?year=${year}`, {
          headers: authHeaders(),
        });
        const data = await res.json().catch(() => null);
        setPublicHolidays(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setPublicHolidays([]);
      }
    })();
  }, [year]);

  // Load leaves for this branch for the year (for stats)
  useEffect(() => {
    if (!branchId) return;
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    (async () => {
      try {
        const res = await fetch(`${API}/leaves?branchId=${branchId}&from=${from}&to=${to}`, {
          headers: authHeaders(),
        });
        const data = await res.json().catch(() => null);
        setLeaves(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setLeaves([]);
      }
    })();
  }, [branchId, year]);

  const hoursTakenAllTypesByEmployee = useMemo(() => {
    const map = new Map();
    for (const l of leaves) {
      map.set(l.employeeId, (map.get(l.employeeId) || 0) + (Number(l.hours) || 0));
    }
    return map;
  }, [leaves]);

  const leaveHoursTakenByEmployee = useMemo(() => {
    const map = new Map();
    for (const l of leaves) {
      map.set(l.employeeId, (map.get(l.employeeId) || 0) + (Number(l.hours) || 0));
    }
    return map;
  }, [leaves]);

  async function refresh() {
    if (!branchId) return;

    try {
      const res = await fetch(`${API}/employees?branchId=${branchId}`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => null);
      setEmployees(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setEmployees([]);
    }

    const from = `${year}-01-01`;
    const to = `${year}-12-31`;

    try {
      const res2 = await fetch(`${API}/leaves?branchId=${branchId}&from=${from}&to=${to}`, {
        headers: authHeaders(),
      });
      const data2 = await res2.json().catch(() => null);
      setLeaves(Array.isArray(data2) ? data2 : []);
    } catch (e) {
      console.error(e);
      setLeaves([]);
    }
  }

  async function addEmployee(ev) {
    ev.preventDefault();
    const n = name.trim();
    if (!n || !branchId) return;

    if (!branchId || typeof branchId !== "string") {
      setMsg("Invalid branch selected.");
      return;
    }

    setLoading(true);
    setMsg("");
    try {
      const payload = {
        branchId,
        name: n,
        allowedHolidayHoursPerYear: Number(allowedHolidayHoursPerYear) || 0,
        weeklyHours: normalizeWeek(weeklyHours),
      };

      const res = await fetch(`${API}/employees`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      setName("");
      setAllowedHolidayHoursPerYear("224");
      setWeeklyHours({ ...DEFAULT_WEEK_STR });
      setMsg("Employee added.");
      await refresh();
    } catch (e) {
      console.error(e);
      setMsg("Error adding employee. Check server logs.");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(emp) {
    setEditingId(emp.id);
    setEditDraft({
      id: emp.id,
      name: emp.name,
      allowedHolidayHoursPerYear: String(emp.allowedHolidayHoursPerYear ?? 0),
      weeklyHours: weekToStrings(emp.weeklyHours),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function saveEdit() {
    if (!editDraft?.name?.trim()) return;

    setLoading(true);
    setMsg("");
    try {
      const payload = {
        name: editDraft.name.trim(),
        allowedHolidayHoursPerYear: Number(editDraft.allowedHolidayHoursPerYear) || 0,
        weeklyHours: normalizeWeek(editDraft.weeklyHours),
      };

      const res = await fetch(`${API}/employees/${editDraft.id}`, {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      cancelEdit();
      setMsg("Employee updated.");
      await refresh();
    } catch (e) {
      console.error(e);
      setMsg("Error updating employee. Check server logs.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteEmployee(id) {
    if (!id) return;
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`${API}/employees/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(await res.text());
      setMsg("Employee deleted.");
      await refresh();
    } catch (e) {
      console.error(e);
      setMsg("Error deleting employee. Check server logs.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="pageHeader">
        <h1 className="h1">Employees</h1>
        <p className="muted">
          Add/edit employees and set weekly working hours. Remaining holiday is calculated as:
          <br />
          <b>Allowed − Holiday Taken − Public Holidays (year)</b>
        </p>
      </div>

      <div className="grid2">
        {/* Add */}
        <div className="card">
          <div className="cardHeader">
            <h3 className="h3">Add New Employee</h3>
          </div>

          <form className="form" onSubmit={addEmployee}>
            <div className="formRow">
              <label className="label">Employee Name</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Smith"
              />
            </div>

            <div className="formRow">
              <label className="label">Holiday Allowance / Year (hours)</label>
              <input
                className="input"
                inputMode="decimal"
                value={allowedHolidayHoursPerYear}
                onChange={(e) => setAllowedHolidayHoursPerYear(e.target.value)}
              />
              <div className="mutedSm">Example: 28 days × 8h = 224 hours</div>
            </div>

            <WeekHoursEditor value={weeklyHours} onChange={setWeeklyHours} />

            <div className="formActions">
              <button className="btn" type="submit" disabled={!name.trim() || loading}>
                {loading ? "Saving..." : "Add Employee"}
              </button>
            </div>

            {msg && (
              <div className="mutedSm" style={{ marginTop: 8 }}>
                {msg}
              </div>
            )}
          </form>
        </div>

        {/* List */}
        <div className="card">
          <div className="cardHeader">
            <h3 className="h3">Employee List</h3>
            <div className="muted">{employees.length} employee(s)</div>
          </div>

          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Allowed (hrs)</th>
                  <th>Holiday Taken (hrs)</th>
                  <th>Public Holidays (Year) (hrs)</th>
                  <th>Remaining (hrs)</th>
                  <th>All Types Taken (hrs)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="emptyCell">
                      No employees yet.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => {
                    const allowed = Number(emp.allowedHolidayHoursPerYear || 0);
                    const allTaken = Number(leaveHoursTakenByEmployee.get(emp.id) || 0);

                    const phYear = calcPublicHolidayHoursForYear(
                      year,
                      emp.weeklyHours,
                      publicHolidays
                    );
                    const remaining = Math.max(0, allowed - allTaken - phYear);

                    return (
                      <tr key={emp.id}>
                        <td className="strong">{emp.name}</td>
                        <td>{round2(allowed)}</td>
                        <td>{round2(allTaken)}</td>

                        <td>{round2(phYear)}</td>
                        <td>{round2(remaining)}</td>
                        <td>{round2(allTaken)}</td>
                        <td className="tdRight">
                          <button
                            className="btn"
                            onClick={() => startEdit(emp)}
                            style={{ marginRight: 8 }}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btnDanger"
                            onClick={() => deleteEmployee(emp.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="hint">
            Remaining = Allowed − Holiday Taken − Public Holidays (whole year).
          </div>
        </div>
      </div>

      {/* Edit Panel */}
      {editingId && editDraft && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="cardHeader">
            <h3 className="h3">Edit Employee</h3>
            <div className="muted">Update weekly hours + allowance</div>
          </div>

          <div className="form">
            <div className="formRow">
              <label className="label">Employee Name</label>
              <input
                className="input"
                value={editDraft.name}
                onChange={(e) =>
                  setEditDraft((d) => ({ ...d, name: e.target.value }))
                }
              />
            </div>

            <div className="formRow">
              <label className="label">Holiday Allowance / Year (hours)</label>
              <input
                className="input"
                inputMode="decimal"
                value={editDraft.allowedHolidayHoursPerYear}
                onChange={(e) =>
                  setEditDraft((d) => ({
                    ...d,
                    allowedHolidayHoursPerYear: e.target.value,
                  }))
                }
              />
            </div>

            <WeekHoursEditor
              value={editDraft.weeklyHours}
              onChange={(wh) =>
                setEditDraft((d) => ({ ...d, weeklyHours: wh }))
              }
            />

            <div className="formActions">
              <button
                className="btn btnDanger"
                type="button"
                onClick={cancelEdit}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="btn"
                type="button"
                onClick={saveEdit}
                disabled={loading || !editDraft.name.trim()}
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>

            {msg && (
              <div className="mutedSm" style={{ marginTop: 8 }}>
                {msg}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WeekHoursEditor({ value, onChange }) {
  const v = {
    mon: value?.mon ?? "0",
    tue: value?.tue ?? "0",
    wed: value?.wed ?? "0",
    thu: value?.thu ?? "0",
    fri: value?.fri ?? "0",
    sat: value?.sat ?? "0",
    sun: value?.sun ?? "0",
  };

  return (
    <div
      className="card"
      style={{ padding: 12, borderStyle: "dashed", boxShadow: "none" }}
    >
      <div className="strong" style={{ marginBottom: 10 }}>
        Working hours per day
      </div>

      <div className="weekGrid">
        <DayField label="Mon" k="mon" v={v} onChange={onChange} />
        <DayField label="Tue" k="tue" v={v} onChange={onChange} />
        <DayField label="Wed" k="wed" v={v} onChange={onChange} />
        <DayField label="Thu" k="thu" v={v} onChange={onChange} />
        <DayField label="Fri" k="fri" v={v} onChange={onChange} />
        <DayField label="Sat" k="sat" v={v} onChange={onChange} />
        <DayField label="Sun" k="sun" v={v} onChange={onChange} />
      </div>

      <div className="mutedSm" style={{ marginTop: 8 }}>
        Type hours (e.g. 4, 8, 7.5). Use 0 for non-working days.
      </div>
    </div>
  );
}

function DayField({ label, k, v, onChange }) {
  return (
    <div className="dayField">
      <label className="labelSm">{label}</label>
      <input
        className="input hourInput"
        inputMode="decimal"
        placeholder="0"
        value={v[k]}
        onChange={(e) => onChange({ ...v, [k]: e.target.value })}
      />
    </div>
  );
}

function normalizeWeek(weekStr) {
  const out = {};
  for (const k of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]) {
    const raw = weekStr?.[k] ?? "0";
    const n = Number(String(raw).trim());
    out[k] = Number.isFinite(n) ? n : 0;
  }
  return out;
}

function weekToStrings(weekNum) {
  const base = { ...DEFAULT_WEEK_STR };
  for (const k of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]) {
    base[k] = String(Number(weekNum?.[k] ?? base[k]));
  }
  return base;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
