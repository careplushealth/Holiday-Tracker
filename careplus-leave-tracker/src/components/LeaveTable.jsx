import React from "react";

export default function LeaveTable({ leaves, employeesById, onDelete }) {
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
              <th>Days</th>
              <th>Comment</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {leaves.length === 0 ? (
              <tr>
                <td colSpan={7} className="emptyCell">
                  No leave records yet.
                </td>
              </tr>
            ) : (
              leaves.map((l) => (
                <tr key={l.id}>
                  <td className="strong">{employeesById[l.employeeId]?.name || "Unknown"}</td>
                  <td>{l.startDate}</td>
                  <td>{l.endDate}</td>
                  <td>
                    <span className={`pill ${pillClass(l.type)}`}>{l.type}</span>
                  </td>
                  <td className="strong">{l.days}</td>
                  <td className="muted">{l.comment || "—"}</td>
                  <td className="tdRight">
                    <button className="btn btnDanger" onClick={() => onDelete(l.id)}>
                      Delete
                    </button>
                  </td>
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
  if (type === "Holiday") return "pillHoliday";
  if (type === "Sick Leave") return "pillSick";
  return "pillOther";
}
