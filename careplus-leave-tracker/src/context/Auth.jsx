import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { API_URL } from "../utils/api.js";

const AuthContext = createContext(null);
const AUTH_KEY = "careplus_auth_v1";

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

async function apiLogin(username, password) {
  if (!API_URL) {
    return { ok: false, message: "VITE_API_URL is not set." };
  }

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.ok) {
      return { ok: false, message: data?.message || "Invalid credentials." };
    }

    return { ok: true, data };
  } catch (e) {
    console.error("apiLogin error:", e);
    return { ok: false, message: e?.message || "Login failed." };
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadSession());

  useEffect(() => {
    saveSession(session);
  }, [session]);

  const api = useMemo(() => {
    async function loginAdmin(username, password) {
      const u = username.trim();
      const p = password;

      const result = await apiLogin(u, p);
      if (!result.ok) return result;

      const { role, token, branchId, username: returnedUsername } = result.data;

      if (role !== "admin") {
        return { ok: false, message: "This account is not an admin account." };
      }

      setSession({
        role: "admin",
        token,
        username: returnedUsername || u,
        branchId: branchId ?? null,
      });

      return { ok: true };
    }

    async function loginBranch(selectedBranchId, username, password) {
      const u = username.trim();
      const p = password;

      const result = await apiLogin(u, p);
      if (!result.ok) return result;

      const { role, token, branchId, username: returnedUsername } = result.data;

      if (role !== "branch") {
        return { ok: false, message: "This account is not a branch account." };
      }

      // Critical security check:
      // Branch user must match the branch selected in the dropdown.
      if (!branchId || String(branchId) !== String(selectedBranchId)) {
        return { ok: false, message: "This user does not belong to the selected branch." };
      }

      setSession({
        role: "branch",
        token,
        username: returnedUsername || u,
        branchId: String(branchId),
      });

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
