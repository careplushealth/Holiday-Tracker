import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/Auth.jsx";

export default function ProtectedRoute({ allow, children }) {
  const { session } = useAuth();

  if (!session) return <Navigate to="/login" replace />;

  // allow: ["admin"] or ["branch"] or ["admin","branch"]
  if (allow && !allow.includes(session.role)) {
    return <Navigate to={session.role === "branch" ? "/branch" : "/"} replace />;
  }

  return children;
}
