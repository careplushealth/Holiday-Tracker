import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

import LeaveEntryPage from "./pages/LeaveEntryPage.jsx";
import EmployeesPage from "./pages/EmployeesPage.jsx";
import CalendarPage from "./pages/CalendarPage.jsx";
import PublicHolidaysPage from "./pages/PublicHolidaysPage.jsx";

import LoginPage from "./pages/LoginPage.jsx";
import BranchLeavePage from "./pages/BranchLeavePage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Everything logged-in uses Layout so it keeps same spacing */}
      <Route
        element={
          <ProtectedRoute allow={["admin", "branch"]}>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Admin pages */}
        <Route
          path="/"
          element={
            <ProtectedRoute allow={["admin"]}>
              <LeaveEntryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees"
          element={
            <ProtectedRoute allow={["admin"]}>
              <EmployeesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute allow={["admin"]}>
              <CalendarPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/public-holidays"
          element={
            <ProtectedRoute allow={["admin"]}>
              <PublicHolidaysPage />
            </ProtectedRoute>
          }
        />

        {/* Branch page */}
        <Route
          path="/branch"
          element={
            <ProtectedRoute allow={["branch"]}>
              <BranchLeavePage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
