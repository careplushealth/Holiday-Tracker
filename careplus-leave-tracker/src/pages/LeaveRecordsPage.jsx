import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../context/Store.jsx";
import LeaveTable from "../components/LeaveTable.jsx";
import { calculateHours, toISODate, parseISO, eachDayInclusive, getScheduledHoursForISO } from "../utils/dates.js";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

const TYPE_OPTIONS = [
    { label: "All Types", value: "" },
    { label: "Holiday", value: "ANNUAL" },
    { label: "Sick Leave", value: "SICK" },
    { label: "Unpaid", value: "UNPAID" },
    { label: "Other", value: "OTHER" },
];

const PRESET_OPTIONS = [
    { label: "Custom Range", value: "custom" },
    { label: "Last 7 Days", value: "7" },
    { label: "Last 30 Days", value: "30" },
    { label: "Last 90 Days", value: "90" },
    { label: "Last 365 Days", value: "365" },
];

export default function LeaveRecordsPage() {
    const { state } = useStore();
    const branchId = state.activeBranchId;

    const [employees, setEmployees] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");

    // Filter state
    const [filterEmployee, setFilterEmployee] = useState("");
    const [filterType, setFilterType] = useState("");
    const [filterFrom, setFilterFrom] = useState("");
    const [filterTo, setFilterTo] = useState("");
    const [filterPreset, setFilterPreset] = useState("custom");

    const year = new Date().getFullYear();

    const employeesById = useMemo(() => {
        const map = {};
        for (const e of employees) map[e.id] = e;
        return map;
    }, [employees]);

    // Public holidays for calc (if employee selected)
    const publicHolidaySet = useMemo(() => {
        const list = state.publicHolidaysByYear?.[year] || [];
        const dates = list.map((h) => (typeof h === "string" ? h : h?.date)).filter(Boolean);
        return new Set(dates);
    }, [state.publicHolidaysByYear, year]);

    // Load employees + leaves
    useEffect(() => {
        if (!branchId) {
            setEmployees([]);
            setLeaves([]);
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

                setEmployees(Array.isArray(eData) ? eData : []);
                setLeaves(Array.isArray(lData) ? lData : []);
            } catch (err) {
                console.error(err);
                setEmployees([]);
                setLeaves([]);
                setMsg("Failed to load data. Check server.");
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

    async function onDeleteLeave(leaveId) {
        if (!leaveId) return;
        if (!window.confirm("Are you sure you want to delete this leave record?")) return;

        let token = "";
        try {
            const raw = localStorage.getItem("careplus_auth_v1");
            const session = raw ? JSON.parse(raw) : null;
            token = session?.token || "";
        } catch {
            token = "";
        }

        setLoading(true);
        setMsg("");
        try {
            const res = await fetch(`${API}/leaves?id=${encodeURIComponent(leaveId)}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });
            if (!res.ok) throw new Error(await res.text());
            setMsg("Leave deleted.");
            await refreshLeaves();
        } catch (err) {
            console.error(err);
            setMsg("Error deleting leave. Check server logs.");
        } finally {
            setLoading(false);
        }
    }

    // Handle preset changes
    const onPresetChange = (val) => {
        setFilterPreset(val);
        if (val === "custom") return;

        const days = parseInt(val);
        const to = new Date();
        const from = new Date();
        from.setDate(to.getDate() - (days - 1));

        setFilterTo(toISODate(to));
        setFilterFrom(toISODate(from));
    };

    // Apply filters
    const filteredLeaves = useMemo(() => {
        return leaves.filter((l) => {
            if (filterEmployee && l.employeeId !== filterEmployee) return false;
            if (filterType && l.type !== filterType) return false;
            if (filterFrom && l.startDate < filterFrom) return false;
            if (filterTo && l.endDate > filterTo) return false;
            return true;
        });
    }, [leaves, filterEmployee, filterType, filterFrom, filterTo]);

    // Advanced stats
    const stats = useMemo(() => {
        const total = filteredLeaves.length;
        const totalLeaveHours = filteredLeaves.reduce((s, l) => s + (Number(l.hours) || 0), 0);
        const annualHours = filteredLeaves.filter(l => l.type === 'ANNUAL').reduce((s, l) => s + (Number(l.hours) || 0), 0);
        const sickHours = filteredLeaves.filter(l => l.type === 'SICK').reduce((s, l) => s + (Number(l.hours) || 0), 0);
        const unpaidHours = filteredLeaves.filter(l => l.type === 'UNPAID').reduce((s, l) => s + (Number(l.hours) || 0), 0);
        
        let workedHours = null;
        let expectedHours = null;
        let allowedHours = null;
        let bankHolidayHours = null;

        if (filterEmployee) {
            const emp = employeesById[filterEmployee];
            if (emp) {
                allowedHours = emp.allowedHolidayHoursPerYear || 0;

                if (filterFrom && filterTo) {
                    expectedHours = calculateHours(filterFrom, filterTo, emp.weeklyHours, publicHolidaySet);
                    workedHours = Math.max(0, expectedHours - totalLeaveHours);

                    // Calculate bank holiday hours taken (that were scheduled)
                    const daysInRange = eachDayInclusive(filterFrom, filterTo);
                    let bhTotal = 0;
                    for (const day of daysInRange) {
                        if (publicHolidaySet.has(day)) {
                            bhTotal += getScheduledHoursForISO(day, emp.weeklyHours);
                        }
                    }
                    bankHolidayHours = bhTotal;
                }
            }
        }

        return { 
            total, 
            totalLeaveHours: round2(totalLeaveHours),
            annualHours: round2(annualHours),
            sickHours: round2(sickHours),
            unpaidHours: round2(unpaidHours),
            workedHours: workedHours !== null ? round2(workedHours) : null,
            expectedHours: expectedHours !== null ? round2(expectedHours) : null,
            allowedHours: allowedHours !== null ? round2(allowedHours) : null,
            bankHolidayHours: bankHolidayHours !== null ? round2(bankHolidayHours) : null
        };
    }, [filteredLeaves, filterEmployee, filterFrom, filterTo, employeesById, publicHolidaySet]);

    function clearFilters() {
        setFilterEmployee("");
        setFilterType("");
        setFilterFrom("");
        setFilterTo("");
        setFilterPreset("custom");
    }

    function round2(n) {
        return Math.round((Number(n) || 0) * 100) / 100;
    }

    const hasFilters = filterEmployee || filterType || filterFrom || filterTo;
    const needsBranch = !branchId;

    return (
        <div className="page">
            <div className="pageHeader">
                <h1 className="h1">Leave Records</h1>
                <p className="muted">
                    View, filter, and manage all leave records for the selected branch.
                </p>
            </div>

            {needsBranch ? (
                <div className="card">
                    <div className="notice">Select a branch first (top left) to view leave records.</div>
                </div>
            ) : (
                <>
                    {/* Filter bar */}
                    <div className="card" style={{ marginBottom: 14 }}>
                        <div className="cardHeader">
                            <h3 className="h3">Filters</h3>
                            {hasFilters && (
                                <button className="btn btnOutline" onClick={clearFilters}>
                                    Clear Filters
                                </button>
                            )}
                        </div>

                        <div className="toolbar">
                            <div className="tool toolGrow">
                                <label className="label">Employee</label>
                                <select
                                    className="select"
                                    value={filterEmployee}
                                    onChange={(e) => setFilterEmployee(e.target.value)}
                                >
                                    <option value="">All Employees</option>
                                    {employees.map((emp) => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="tool">
                                <label className="label">Quick Filter</label>
                                <select
                                    className="select"
                                    value={filterPreset}
                                    onChange={(e) => onPresetChange(e.target.value)}
                                >
                                    {PRESET_OPTIONS.map((p) => (
                                        <option key={p.value} value={p.value}>
                                            {p.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="tool">
                                <label className="label">From</label>
                                <input
                                    className="input"
                                    type="date"
                                    value={filterFrom}
                                    onChange={(e) => {
                                        setFilterFrom(e.target.value);
                                        setFilterPreset("custom");
                                    }}
                                />
                            </div>

                            <div className="tool">
                                <label className="label">To</label>
                                <input
                                    className="input"
                                    type="date"
                                    value={filterTo}
                                    onChange={(e) => {
                                        setFilterTo(e.target.value);
                                        setFilterPreset("custom");
                                    }}
                                />
                            </div>

                            <div className="tool">
                                <label className="label">Leave Type</label>
                                <select
                                    className="select"
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value)}
                                >
                                    {TYPE_OPTIONS.map((t) => (
                                        <option key={t.value} value={t.value}>
                                            {t.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Stats summary */}
                    <div className="statsGrid" style={{ marginBottom: 14 }}>
                        <div className="statBox">
                            <div className="statLabel">Total Records</div>
                            <div className="statValue">{stats.total}</div>
                            <div className="mutedSm">In selected range</div>
                        </div>
                        {stats.workedHours !== null && (
                            <div className="statBox statBoxPrimary">
                                <div className="statLabel" style={{ color: 'var(--nav)' }}>Hours Worked</div>
                                <div className="statValue" style={{ color: 'var(--nav)' }}>{stats.workedHours}h</div>
                                <div className="mutedSm">Target: {stats.expectedHours}h</div>
                            </div>
                        )}
                        <div className="statBox">
                            <div className="statLabel">Leaves Taken</div>
                            <div className="statValue">{stats.totalLeaveHours}h</div>
                            <div className="mutedSm">Total off-time</div>
                        </div>
                        <div className="statBox">
                            <div className="statLabel">Holidays</div>
                            <div className="statValue" style={{ color: 'var(--holiday)' }}>{stats.annualHours}h</div>
                            <div className="mutedSm">Annual Leave</div>
                        </div>
                        {stats.allowedHours !== null && (
                            <div className="statBox">
                                <div className="statLabel">Total Allowed</div>
                                <div className="statValue">{stats.allowedHours}h</div>
                                <div className="mutedSm">Yearly allowance</div>
                            </div>
                        )}
                        {stats.bankHolidayHours !== null && (
                            <div className="statBox">
                                <div className="statLabel">Bank Holidays</div>
                                <div className="statValue" style={{ color: 'var(--nav)' }}>{stats.bankHolidayHours}h</div>
                                <div className="mutedSm">Public holidays in range</div>
                            </div>
                        )}
                        <div className="statBox">
                            <div className="statLabel">Sick Leave</div>
                            <div className="statValue" style={{ color: 'var(--sick)' }}>{stats.sickHours}h</div>
                            <div className="mutedSm">Sick hours logged</div>
                        </div>
                        {stats.unpaidHours > 0 && (
                            <div className="statBox">
                                <div className="statLabel">Unpaid</div>
                                <div className="statValue">{stats.unpaidHours}h</div>
                                <div className="mutedSm">Unpaid leave</div>
                            </div>
                        )}
                    </div>

                    {msg && (
                        <div
                            className={msg.includes("Error") || msg.includes("Failed") ? "errorBox" : "successBox"}
                            style={{ marginBottom: 14 }}
                        >
                            {msg}
                        </div>
                    )}

                    <LeaveTable
                        leaves={filteredLeaves}
                        employeesById={employeesById}
                        onDelete={onDeleteLeave}
                    />
                </>
            )}
        </div>
    );
}
