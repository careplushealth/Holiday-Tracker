import React, { useMemo, useEffect, useState } from "react";
import { useAuth } from "../context/Auth.jsx";
import { getYearFromISO } from "../utils/dates.js";
import { calculateHours } from "../utils/dates.js";
import { calcPublicHolidayHoursForYear } from "../utils/holidayHours.js";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

// Backend types
const TYPE_OPTIONS = [
  { label: "Holiday", value: "ANNUAL" },
  { label: "Sick Leave", value: "SICK" },
  { label: "Unpaid", value: "UNPAID" },
  { label: "Other", value: "OTHER" },
];

// Map old Store branch ids → DB branch names
const LEGACY_BRANCH_ID_TO_NAME = {
  careplus_chemist: "Careplus Chemist",
  wilmslow_road: "Wilmslow Road Pharmacy",
  pharmacy_247: "247 Pharmacy",
};

function looksLikeUuid(s) {
  return typeof s === "string" && s.includes("-") && s.length >= 32;
}

export default function BranchLeavePage() {
  const { session } = useAuth();

  const currentYear = new Date().getFullYear();

  const [branches, setBranches] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [publicHolidays, setPublicHolidays] = useState([]);

  const [employeeId, setEmployeeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [type, setType] = useState("ANNUAL");
  const [comment, setComment] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Load branches from DB (resolve UUID)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/branches`);
        const data = await res.json();
        setBranches(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setBranches([]);
      }
    })();
  }, []);

  // Resolve branchId to a DB UUID
  const effectiveBranch = useMemo(() => {
    const raw = session?.branchId || "";
    if (!raw) return null;

    if (looksLikeUuid(raw)) {
      return branches.find((b) => b.id === raw) || { id: raw, name: "Branch" };
    }

    const expectedName = LEGACY_BRANCH_ID_TO_NAME[raw];
    if (!expectedName) return null;

    return (
      branches.find((b) => String(b.name).toLowerCase() === expectedName.toLowerCase()) || null
    );
  }, [session?.branchId, branches]);

  const branchId = effectiveBranch?.id || "";
  const branchName = effectiveBranch?.name || "Branch";

  // Use year from date inputs if set, otherwise current year
  const year = useMemo(() => {
    return getYearFromISO(startDate) || getYearFromISO(endDate) || currentYear;
  }, [startDate, endDate, currentYear]);

  // Load employees for this branch
  useEffect(() => {
    if (!branchId) {
      setEmployees([]);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API}/employees?branchId=${encodeURIComponent(branchId)}`);
        const data = await res.json();
        setEmployees(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setEmployees([]);
      }
    })();
  }, [branchId]);

  // Keep selected employeeId valid
  useEffect(() => {
    if (!employees.length) {
      setEmployeeId("");
      return;
    }
    setEmployeeId((prev) => (prev && employees.some((e) => e.id === prev) ? prev : employees[0].id));
  }, [employees]);

  // Load public holidays for selected year
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/public-holidays?year=${year}`);
        const data = await res.json();
        setPublicHolidays(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setPublicHolidays([]);
      }
    })();
  }, [year]);

  const publicHolidaySet = useMemo(
    () => new Set((publicHolidays || []).map((h) => h.date)),
    [publicHolidays]
  );

  // Load leaves for this branch for selected year (range-based)
  useEffect(() => {
    if (!branchId) {
      setLeaves([]);
      return;
    }

    const from = `${year}-01-01`;
    const to = `${year}-12-31`;

    (async () => {
      try {
        const res = await fetch(
          `${API}/leaves?branchId=${encodeURIComponent(branchId)}&from=${from}&to=${to}`
        );
        const data = await res.json();
        setLeaves(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setLeaves([]);
      }
    })();
  }, [branchId, year]);

  const employee = useMemo(
    () => employees.find((e) => e.id === employeeId) || null,
    [employees, employeeId]
  );

  // Auto-calc total hours for range (UI display only)
  const hours = useMemo(() => {
    if (!startDate || !endDate || !employee) return 0;
    return calculateHours(startDate, endDate, employee.weeklyHours, publicHolidaySet);
  }, [startDate, endDate, employee, publicHolidaySet]);

  const employeeLeaves = useMemo(
    () => leaves.filter((l) => l.employeeId === employeeId),
    [leaves, employeeId]
  );

  const stats = useMemo(() => {
    if (!employee) return null;

    let totalTaken = 0;
    let annualTaken = 0;
    let sickTaken = 0;
    let otherTaken = 0;

    for (const l of employeeLeaves) {
      const h = Number(l.hours) || 0;
      totalTaken += h;
      if (l.type === "ANNUAL") annualTaken += h;
      else if (l.type === "SICK") sickTaken += h;
      else otherTaken += h;
    }

    const allowedHoliday = Number(employee.allowedHolidayHoursPerYear || 0);
    const phYear = calcPublicHolidayHoursForYear(year, employee.weeklyHours, publicHolidays);
    const remainingHoliday = Math.max(0, allowedHoliday - annualTaken - phYear);

    return { allowedHoliday, totalTaken, annualTaken, sickTaken, otherTaken, phYear, remainingHoliday };
  }, [employee, employeeLeaves, year, publicHolidays]);

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
    setSavedMsg("");

    if (!branchId) {
      setSavedMsg("Branch is not linked to a valid DB branch. Contact admin.");
      return;
    }
    if (!employeeId || !startDate || !endDate || !employee) return;
    if (startDate > endDate) {
  setSavedMsg("End date must be after start date.");
  return;
}


    if (hours <= 0) return;

    setLoading(true);
    try {
      // ✅ Store ONE record with start/end range
      const payload = {
        branchId,
        employeeId,
        startDate,
        endDate,
        hours, // total hours (calculated)
        type,
        comment: comment.trim(),
      };

      const res = await fetch(`${API}/leaves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      await refreshLeaves();

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

  const missingBranchLink = !!session?.branchId && !branchId;

  return (
    <div className="page">
      <div className="pageHeader">
        <h1 className="h1">Leave Entry</h1>
        <p className="muted">{branchName} • Branch access: add leave only.</p>
        <p className="mutedSm">
          Debug: session.branchId = <b>{String(session?.branchId || "")}</b> • resolved branchId ={" "}
          <b>{String(branchId || "")}</b>
        </p>
      </div>

      {missingBranchLink && (
        <div className="notice">
          Your branch user is linked to <b>{String(session?.branchId)}</b> but that does not match any DB branch.
          Fix by updating the branch user to store the DB branch UUID, or ensure DB branch names match the mapping.
        </div>
      )}

      <div className="grid2">
        {/* LEFT: Form */}
        <div className="card">
          <div className="cardHeader">
            <h3 className="h3">New Leave</h3>
            <div className="muted">Hours auto-calculated</div>
          </div>

          {!branchId ? (
            <div className="notice">No valid branch selected / resolved.</div>
          ) : employees.length === 0 ? (
            <div className="notice">No employees set for this branch. Please contact admin to add employees.</div>
          ) : (
            <form className="form" onSubmit={submit}>
              <div className="formRow">
                <label className="label">Employee</label>
                <select className="select" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
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
                      ? `Mon ${employee.weeklyHours?.mon ?? 0}h, Tue ${employee.weeklyHours?.tue ?? 0}h, Wed ${
                          employee.weeklyHours?.wed ?? 0
                        }h, Thu ${employee.weeklyHours?.thu ?? 0}h, Fri ${employee.weeklyHours?.fri ?? 0}h`
                      : "—"}
                  </b>
                </div>
              </div>

              <div className="formRow2">
                <div>
                  <label className="label">Start Date</label>
                  <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="label">End Date</label>
                  <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>

              <div className="formRow2">
                <div>
                  <label className="label">Type of Leave</label>
                  <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
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
                  rows={3}
                  placeholder="e.g. Dentist appointment..."
                />
              </div>

              {savedMsg && <div className="successBox">{savedMsg}</div>}

              <div className="formActions">
                <button className="btn" type="submit" disabled={loading || !employeeId || !startDate || !endDate || hours <= 0}>
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
                <Stat label="Holiday Taken (hrs)" value={round2(stats.annualTaken)} />
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
