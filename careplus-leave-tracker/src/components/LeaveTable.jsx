import React from "react";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  // dateStr is "YYYY-MM-DD"
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

export default function LeaveTable({ leaves, employeesById, onDelete }) {
  const showDelete = typeof onDelete === "function";

  return (
    <div className="card">
      <div className="cardHeader">
        <h3 className="h3">Leave Records</h3>
        <div className="muted">Newest first</div>
      </div>

      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Start</th>
              <th>End</th>
              <th>Type</th>
              <th>Total Hours</th>
              <th>Comment</th>
              {showDelete && <th></th>}
            </tr>
          </thead>
          <tbody>
            {leaves.length === 0 ? (
              <tr>
                <td colSpan={showDelete ? 7 : 6} className="emptyCell">
                  No leave records yet.
                </td>
              </tr>
            ) : (
              leaves.map((l) => (
                <tr key={l.id}>
                  <td className="strong">{employeesById[l.employeeId]?.name || "Unknown"}</td>
                  <td>{formatDate(l.startDate)}</td>
                  <td>{formatDate(l.endDate)}</td>
                  <td>
                    <span className={`pill ${pillClass(l.type)}`}>{typeLabel(l.type)}</span>
                  </td>
                  <td className="strong">{Number(l.hours) || 0}</td>
                  <td className="muted">{l.comment || "—"}</td>
                  {showDelete && (
                    <td className="tdRight">
                      <button className="btn btnDanger" onClick={() => onDelete(l.id)}>
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function pillClass(type) {
  if (type === "ANNUAL") return "pillHoliday";
  if (type === "SICK") return "pillSick";
  return "pillOther";
}

function typeLabel(type) {
  if (type === "ANNUAL") return "Holiday";
  if (type === "SICK") return "Sick Leave";
  if (type === "UNPAID") return "Unpaid";
  if (type === "OTHER") return "Other";
  return type;
}

