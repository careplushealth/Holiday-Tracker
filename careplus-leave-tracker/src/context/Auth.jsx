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
    '4ef247f9-010e-41a9-bf54-4994b2c7b171': { username: "careplus", password: "Careplus@123" },
    'cc09b3a5-c2fc-46c2-b3d1-3d1df7ee6ab0': { username: "wilmslow", password: "Wilmslow@123" },
    '17251c63-d7ca-4cbb-8630-ffb8a1b13b42': { username: "pharmacy247", password: "Pharmacy247@123" },
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
  // 1) try direct match first (works if branchId is careplus_chemist etc.)
  let c = CREDENTIALS.branches[branchId];

  // 2) fallback: try to match by "slug" derived from the branchId/name-like string
  if (!c && typeof branchId === "string") {
    const normalized = branchId.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

    c =
      CREDENTIALS.branches[normalized] ||
      CREDENTIALS.branches[`pharmacy_${normalized}`] ||
      CREDENTIALS.branches[`_${normalized}`];
  }

  const ok = c && username === c.username && password === c.password;
  console.log({ok,password,c, branchId})
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
