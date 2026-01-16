import React from "react";
import { useStore } from "../context/Store.jsx";

export default function BranchSwitcher() {
  const { state, dispatch } = useStore();
  const branches = state.branches || [];
  const activeBranchId = state.activeBranchId ?? "";

  function onChange(e) {
    dispatch({
      type: "SET_ACTIVE_BRANCH",
      payload: e.target.value,
    });
  }

  return (
    <div className="branchSwitcher">
      <label className="labelSm">Branch</label>

      <select
        className="select"
        value={activeBranchId}
        onChange={onChange}
        disabled={branches.length === 0}
      >
        <option value="" disabled>
          Select branch
        </option>

        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  );
}
