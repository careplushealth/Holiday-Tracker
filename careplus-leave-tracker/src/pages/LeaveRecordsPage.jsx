import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../context/Store.jsx";
import LeaveTable from "../components/LeaveTable.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

const TYPE_OPTIONS = [
    { label: "All Types", value: "" },
    { label: "Holiday", value: "ANNUAL" },
    { label: "Sick Leave", value: "SICK" },
    { label: "Unpaid", value: "UNPAID" },
    { label: "Other", value: "OTHER" },
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

    const year = new Date().getFullYear();

    const employeesById = useMemo(() => {
        const map = {};
        for (const e of employees) map[e.id] = e;
        return map;
    }, [employees]);

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

    // Quick stats on filtered results
    const stats = useMemo(() => {
        const total = filteredLeaves.length;
        const totalHours = filteredLeaves.reduce((s, l) => s + (Number(l.hours) || 0), 0);
        return { total, totalHours: Math.round(totalHours * 100) / 100 };
    }, [filteredLeaves]);

    function clearFilters() {
        setFilterEmployee("");
        setFilterType("");
        setFilterFrom("");
        setFilterTo("");
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
                            <div className="tool">
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
                                <label className="label">From</label>
                                <input
                                    className="input"
                                    type="date"
                                    value={filterFrom}
                                    onChange={(e) => setFilterFrom(e.target.value)}
                                />
                            </div>

                            <div className="tool">
                                <label className="label">To</label>
                                <input
                                    className="input"
                                    type="date"
                                    value={filterTo}
                                    onChange={(e) => setFilterTo(e.target.value)}
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
                    <div className="card" style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
                            <div>
                                <span className="mutedSm">Showing </span>
                                <span className="strong">{stats.total}</span>
                                <span className="mutedSm"> record{stats.total !== 1 ? "s" : ""}</span>
                            </div>
                            <div>
                                <span className="mutedSm">Total Hours: </span>
                                <span className="strong">{stats.totalHours}</span>
                            </div>
                            {hasFilters && (
                                <div className="mutedSm" style={{ marginLeft: "auto" }}>
                                    Filtered from {leaves.length} total records
                                </div>
                            )}
                        </div>
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
