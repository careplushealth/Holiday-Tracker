import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/Auth.jsx";
import { useStore } from "../context/Store.jsx";

export default function LoginPage() {
  const nav = useNavigate();
  const { loginAdmin, loginBranch } = useAuth();
  const { state, loadBranches } = useStore();

  const branches = state.branches || [];

  const [mode, setMode] = useState("admin"); // admin | branch
  const [branchId, setBranchId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  // Load branches on first mount (login page needs them)
  useEffect(() => {
    if (!branches.length) {
      loadBranches();
    }
    // only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When switching to branch mode OR when branches arrive, set a default branch
  useEffect(() => {
    if (mode === "branch" && !branchId && branches.length) {
      setBranchId(branches[0].id);
    }
  }, [mode, branchId, branches]);

  const branchName = useMemo(() => {
    return branches.find((b) => b.id === branchId)?.name || "";
  }, [branches, branchId]);

  function submit(e) {
    e.preventDefault();
    setErr("");

    if (mode === "admin") {
      const res = loginAdmin(username.trim(), password);
      if (!res.ok) return setErr(res.message);
      nav("/", { replace: true });
    } else {
      if (!branchId) return setErr("Please select a branch.");
      const res = loginBranch(branchId, username.trim(), password);
      if (!res.ok) return setErr(res.message);
      nav("/branch", { replace: true });
    }
  }

  return (
    <div className="loginShell">
      <div className="loginCard">
        <div className="loginBrand">
          <div className="brandMark">CP</div>
          <div>
            <div className="brandTitle">CarePlus Health</div>
            <div className="brandSub">Leave Tracker</div>
          </div>
        </div>

        <h1 className="h1" style={{ marginTop: 10 }}>
          Sign in
        </h1>
        <p className="muted">
          Admin has full access. Branch accounts can only add leave.
        </p>

        <div className="tabs">
          <button
            className={mode === "admin" ? "tab active" : "tab"}
            onClick={() => setMode("admin")}
            type="button"
          >
            Admin
          </button>
          <button
            className={mode === "branch" ? "tab active" : "tab"}
            onClick={() => setMode("branch")}
            type="button"
          >
            Branch
          </button>
        </div>

        <form className="form" onSubmit={submit}>
          {mode === "branch" && (
            <div className="formRow">
              <label className="label">Branch</label>

              <select
                className="select"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                disabled={!branches.length}
              >
                {!branches.length ? (
                  <option value="">Loading branches...</option>
                ) : (
                  branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))
                )}
              </select>

              <div className="mutedSm">
                Logging into: <b>{branchName || "—"}</b>
              </div>
            </div>
          )}

          <div className="formRow">
            <label className="label">Username</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="formRow">
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {err && <div className="errorBox">{err}</div>}

          <div className="formActions">
            <button className="btn" type="submit">
              Sign in
            </button>
          </div>
        </form>

        <div className="hint" style={{ marginTop: 10 }}>
          You can change default credentials in <b>src/context/Auth.jsx</b>
        </div>
      </div>
    </div>
  );
}
