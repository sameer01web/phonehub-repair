import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import DevicesPage from "./pages/DevicesPage";
import ShipmentsPage from "./pages/ShipmentsPage";
import InspectionPage from "./pages/InspectionPage";
import JobCardsPage from "./pages/JobCardsPage";
import SparePartsPage from "./pages/SparePartsPage";
import ProcurementPage from "./pages/ProcurementPage";
import QualityControlPage from "./pages/QualityControlPage";
import AccessoriesPage from "./pages/AccessoriesPage";
import ReportsPage from "./pages/ReportsPage";
import StaffPage from "./pages/StaffPage";
import GoodsReceiptFifoTest from "./pages/GoodsReceiptFifoTest";
import LoginPage from "./pages/LoginPage";
import { isSupabaseConfigured } from "./lib/supabase";
import { useAuth } from "./lib/auth";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="login-root" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner-sm" style={{ width: 36, height: 36, borderWidth: 3, borderColor: "rgba(1, 118, 211, 0.2)", borderTopColor: "#0176d3", margin: "0 auto 14px" }} />
          <div style={{ color: "#0f172a", fontSize: "14px", fontWeight: 700 }}>Phone Hub Mobile Repair Workshop</div>
          <div style={{ color: "#64748b", fontSize: "12px", marginTop: 4 }}>Checking secure workshop session...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <Routes>
        {/* Dedicated Standalone Full-Screen Login Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signin" element={<LoginPage />} />

        {/* Protected Dashboard Layout Routes - Redirects to /login if unauthenticated */}
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          {/* Main Operational Dashboard */}
          <Route index element={<Dashboard />} />

          {/* 1. Devices & 360° Lifecycle */}
          <Route path="devices" element={<DevicesPage />} />

          {/* 2. Shipments & Consignment Lots */}
          <Route path="shipments" element={<ShipmentsPage />} />

          {/* 3. Hardware Intake Inspections */}
          <Route path="inspections" element={<InspectionPage />} />

          {/* 4. Repair Job Cards & Work Allocation */}
          <Route path="jobs" element={<JobCardsPage />} />

          {/* 5. Spare Parts Catalogue & FIFO Stock */}
          <Route path="parts" element={<SparePartsPage />} />

          {/* 5b. Accessories Inventory */}
          <Route path="accessories" element={<AccessoriesPage />} />

          {/* 6. Procurement, Suppliers & Purchase Orders */}
          <Route path="procurement" element={<ProcurementPage />} />

          {/* 7. Quality Control & Release Gate */}
          <Route path="qc" element={<QualityControlPage />} />

          {/* 8. Operations & Valuation Reports */}
          <Route path="reports" element={<ReportsPage />} />

          {/* 9. Workshop Staff & Technicians */}
          <Route path="staff" element={<StaffPage />} />

          {/* 7. Goods Receipt FIFO Suite */}
          <Route path="goods-receipts" element={<GoodsReceiptFifoTest />} />
          <Route path="fifo-test" element={<GoodsReceiptFifoTest />} />
          <Route path="goods-receipt-fifo" element={<GoodsReceiptFifoTest />} />

          {/* General Settings */}
          <Route path="settings" element={<StaffPage />} />
        </Route>

        {/* Fallback unknown routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {!isSupabaseConfigured && (
        <div className="setup-banner">
          <b>Demo setup:</b> Supabase is not configured. Add your project URL and anon key in{" "}
          <code>.env</code>, then run the SQL migration.
        </div>
      )}
    </>
  );
}
