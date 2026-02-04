import { API_URL } from "./api";

export function getSession() {
  try {
    const raw = localStorage.getItem("careplus_auth_v1");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function authedFetch(path, options = {}) {
  const session = getSession();
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (session?.token) headers.set("Authorization", `Bearer ${session.token}`);

  return fetch(`${API_URL}${path}`, { ...options, headers });
}
