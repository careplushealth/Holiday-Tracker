import React, { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import BranchSwitcher from "./BranchSwitcher.jsx";
import { useAuth } from "../context/Auth.jsx";
import { useStore } from "../context/Store.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function Layout() {
  const { session, logout } = useAuth();
  const { dispatch } = useStore();
  const nav = useNavigate();

  const isAdmin = session?.role === "admin";

  // 🔑 Load branches from backend (single source of truth)
  useEffect(() => {
    if (!isAdmin) return;

    fetch(`${API}/branches`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch branches");
        return res.json();
      })
      .then((branches) => {
        dispatch({
          type: "SET_BRANCHES",
          payload: branches,
        });
      })
      .catch((err) => {
        console.error("Error loading branches:", err);
      });
  }, [dispatch, isAdmin]);

  function doLogout() {
    logout();
    nav("/login", { replace: true });
  }

  return (
    <div className="appShell">
      <header className="topbar">
        <div className="brand">
          <div className="brandText">
            <div className="brandTitle">
             Employee Leave Tracker

            </div>
            <div className="brandSub">CareplusHealth - Internal Tool</div>
          </div>
        </div>

        {isAdmin && <BranchSwitcher />}

        {isAdmin && (
          <nav className="nav">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? "navLink active" : "navLink"
              }
            >
              Leave Entry
            </NavLink>

            <NavLink
              to="/employees"
              className={({ isActive }) =>
                isActive ? "navLink active" : "navLink"
              }
            >
              Employees
            </NavLink>

            <NavLink
              to="/calendar"
              className={({ isActive }) =>
                isActive ? "navLink active" : "navLink"
              }
            >
              Calendar
            </NavLink>

            <NavLink
              to="/public-holidays"
              className={({ isActive }) =>
                isActive ? "navLink active" : "navLink"
              }
            >
              Public Holidays
            </NavLink>
          </nav>
        )}

        {session && (
          <button
            className="btn btnDanger"
            onClick={doLogout}
            style={{ marginLeft: "auto" }}
          >
            Log out
          </button>
        )}
      </header>

      <main className="main">
        <Outlet />
      </main>

      <footer className="footer">
        <span>CarePlus Health • Internal Tool</span>
      </footer>
    </div>
  );
}
