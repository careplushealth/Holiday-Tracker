import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);
const AUTH_KEY = "careplus_auth_v1";

/**
 * Client-side credentials (simple).
 * Replace these with your real ones.
 */
const CREDENTIALS = {
  admin: { username: "admin", password: "Mehraan@123" },
  branches: {
    careplus_chemist: { username: "careplus", password: "Careplus@123" },
    wilmslow_road: { username: "wilmslow", password: "Wilmslow@123" },
    pharmacy_247: { username: "pharmacy247", password: "Pharmacy247@123" },
  },
};

function loadSession() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  try {
    if (!session) localStorage.removeItem(AUTH_KEY);
    else localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadSession());

  useEffect(() => {
    saveSession(session);
  }, [session]);

  const api = useMemo(() => {
    function loginAdmin(username, password) {
      const ok =
        username === CREDENTIALS.admin.username &&
        password === CREDENTIALS.admin.password;
      if (!ok) return { ok: false, message: "Invalid admin credentials." };
      setSession({ role: "admin" });
      return { ok: true };
    }

    function loginBranch(branchId, username, password) {
      const c = CREDENTIALS.branches[branchId];
      const ok = c && username === c.username && password === c.password;
      if (!ok) return { ok: false, message: "Invalid branch credentials." };
      setSession({ role: "branch", branchId });
      return { ok: true };
    }

    function logout() {
      setSession(null);
    }

    return { session, loginAdmin, loginBranch, logout };
  }, [session]);

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
