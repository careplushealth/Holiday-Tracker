import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../context/Store.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function PublicHolidaysPage() {
  const { state, dispatch } = useStore();
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear);
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Display from Store (cache)
  const holidays = useMemo(() => {
    const raw = state.publicHolidaysByYear?.[year] || [];
    return (raw || [])
      .map((item) => {
        if (typeof item === "string") return { date: item, name: "Public Holiday" };
        if (item && typeof item === "object") return { date: item.date, name: item.name || "Public Holiday" };
        return null;
      })
      .filter((h) => h && typeof h.date === "string" && h.date.length >= 10)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [state.publicHolidaysByYear, year]);

  async function fetchYear() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`${API}/public-holidays?year=${year}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      const list = Array.isArray(data)
        ? data
            .map((h) => ({
              date: String(h.date).slice(0, 10),
              name: h.name || "Public Holiday",
            }))
            .filter((h) => h.date?.length >= 10)
            .sort((a, b) => a.date.localeCompare(b.date))
        : [];

      dispatch({ type: "SET_PUBLIC_HOLIDAYS", year, holidays: list });
    } catch (err) {
      console.error(err);
      setMsg("Failed to load public holidays. Check server.");
    } finally {
      setLoading(false);
    }
  }

  // Load from DB whenever year changes
  useEffect(() => {
    fetchYear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  async function addHoliday(e) {
    e.preventDefault();
    if (!newDate || !newName.trim()) return;

    setLoading(true);
    setMsg("");

    try {
      const res = await fetch(`${API}/public-holidays`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newDate, name: newName.trim(), region: null }),
      });

      if (!res.ok) throw new Error(await res.text());

      setNewDate("");
      setNewName("");
      setMsg("Holiday saved.");
      await fetchYear();
    } catch (err) {
      console.error(err);
      setMsg("Failed to save holiday. Check server logs.");
    } finally {
      setLoading(false);
    }
  }

  async function removeHoliday(date) {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`${API}/public-holidays?date=${encodeURIComponent(date)}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error(await res.text());

      setMsg("Holiday removed.");
      await fetchYear();
    } catch (err) {
      console.error(err);
      setMsg("Failed to remove holiday. Check server logs.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="pageHeader">
        <h1 className="h1">Public Holidays</h1>
        <p className="muted">Manage public holidays by year. Holidays are excluded from leave-hour calculations.</p>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
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
              disabled={loading}
            />
          </div>
          <div className="tool toolGrow">{msg && <div className="mutedSm">{msg}</div>}</div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="cardHeader">
            <h3 className="h3">Add Public Holiday</h3>
            <div className="muted">Date + Name</div>
          </div>

          <form className="form" onSubmit={addHoliday}>
            <div className="formRow2">
              <div>
                <label className="label">Date</label>
                <input
                  className="input"
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="label">Name</label>
                <input
                  className="input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Christmas Day"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="formActions">
              <button className="btn" type="submit" disabled={loading || !newDate || !newName.trim()}>
                {loading ? "Saving..." : "Add Holiday"}
              </button>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="cardHeader">
            <h3 className="h3">Holiday List</h3>
            <div className="muted">{holidays.length} holiday(s)</div>
          </div>

          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {holidays.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="emptyCell">
                      {loading ? "Loading..." : `No public holidays set for ${year}.`}
                    </td>
                  </tr>
                ) : (
                  holidays.map((h) => (
                    <tr key={h.date}>
                      <td className="strong">{h.date}</td>
                      <td>{h.name}</td>
                      <td className="tdRight">
                        <button className="btn btnDanger" onClick={() => removeHoliday(h.date)} disabled={loading}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
