import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  PackageCheck,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Layers,
  RefreshCw,
  Eye,
  X,
  FileText,
  Building2,
  Calendar,
  AlertTriangle,
  Lock,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  processGoodsReceiptFifo,
  getGoodsReceiptsList,
  getGoodsReceiptItems,
} from "../lib/fifo";
import type { GoodsReceipt, FifoProcessResult } from "../lib/types";

export default function GoodsReceiptFifoTest() {
  const { user, role, isAuthorizedForFifo } = useAuth();

  const [receiptsList, setReceiptsList] = useState<GoodsReceipt[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"pending" | "processed" | "all">("pending");

  // Inwarding execution state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [resultNotice, setResultNotice] = useState<FifoProcessResult | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Modal: View Items & Inspection breakdown
  const [selectedViewReceipt, setSelectedViewReceipt] = useState<GoodsReceipt | null>(null);
  const [receiptItems, setReceiptItems] = useState<any[]>([]);
  const [itemsLoading, setItemsLoading] = useState<boolean>(false);

  async function loadReceipts() {
    setLoading(true);
    try {
      const data = await getGoodsReceiptsList();
      setReceiptsList(data);
    } catch (err: any) {
      console.error("Error loading goods receipts:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReceipts();
  }, [user]);

  // View Receipt Items in Modal
  async function handleViewReceipt(receipt: GoodsReceipt) {
    setSelectedViewReceipt(receipt);
    setReceiptItems([]);
    setItemsLoading(true);
    try {
      const items = await getGoodsReceiptItems(receipt.id);
      setReceiptItems(items);
    } catch (err) {
      console.warn("Could not load receipt items:", err);
    } finally {
      setItemsLoading(false);
    }
  }

  // Execute FIFO Inwarding Allocation
  async function handleProcessReceipt(receipt: GoodsReceipt) {
    if (!isAuthorizedForFifo) {
      setErrorNotice(
        `Access Restricted: Only owner, workshop_manager, inventory, or procurement roles can allocate goods into FIFO stock.`
      );
      return;
    }

    if (receipt.is_processed) {
      setErrorNotice(
        `Double-Processing Prevented: GRN #${receipt.grn_number || receipt.id.slice(0, 8)} is already allocated into FIFO inventory batches.`
      );
      return;
    }

    setIsProcessing(true);
    setProcessingId(receipt.id);
    setErrorNotice(null);
    setResultNotice(null);

    try {
      const res = await processGoodsReceiptFifo(receipt.id, role);
      setResultNotice(res);
      // Reload receipts to reflect processed status
      await loadReceipts();
      // If modal was open for this receipt, update its status
      if (selectedViewReceipt?.id === receipt.id) {
        setSelectedViewReceipt({ ...receipt, is_processed: true });
      }
    } catch (err: any) {
      setErrorNotice(err?.message || "Failed to process Goods Receipt into FIFO stock.");
    } finally {
      setIsProcessing(false);
      setProcessingId(null);
    }
  }

  const pendingReceipts = receiptsList.filter((r) => !r.is_processed);
  const processedReceipts = receiptsList.filter((r) => r.is_processed);
  const uniqueSuppliers = new Set(receiptsList.map((r) => r.supplier_name).filter(Boolean)).size;

  const currentList =
    activeTab === "pending"
      ? pendingReceipts
      : activeTab === "processed"
      ? processedReceipts
      : receiptsList;

  return (
    <>
      {/* PAGE HEADER */}
      <div className="page-head">
        <div>
          <div className="eyebrow">INVENTORY / GOODS RECEIPT NOTE (GRN)</div>
          <h1>Goods Receipts & FIFO Stock Inwarding</h1>
          <p>
            Receive supplier deliveries, inspect accepted quantities, and allocate stock into FIFO inventory batches for accurate repair costing.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {user && isAuthorizedForFifo ? (
            <span className="tag" style={{ background: "#e8f8f0", color: "#15945b", fontWeight: 700, padding: "8px 12px", fontSize: "11px" }}>
              <ShieldCheck size={14} style={{ display: "inline", marginRight: "6px" }} />
              FIFO Inwarding Authorized ({role?.replace("_", " ")})
            </span>
          ) : user ? (
            <span className="tag" style={{ background: "#fee2e2", color: "#991b1b", fontWeight: 700, padding: "8px 12px", fontSize: "11px" }}>
              <Lock size={14} style={{ display: "inline", marginRight: "6px" }} />
              View Only (Manager/Inventory Role Required)
            </span>
          ) : (
            <Link
              to="/login"
              className="primary-btn"
              style={{ padding: "8px 14px", fontSize: "11px", textDecoration: "none" }}
            >
              Sign In to Inward Stock
            </Link>
          )}

          <button
            className="secondary-btn"
            onClick={loadReceipts}
            disabled={loading}
            title="Refresh goods receipts list"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {!user && (
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "10px",
            padding: "16px 20px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <b style={{ color: "#1e40af", fontSize: "13px", display: "block" }}>
              Workshop Authentication Required
            </b>
            <p style={{ color: "#2563eb", fontSize: "12px", margin: "4px 0 0" }}>
              Please sign in with your workshop account to allocate received supplier goods into active FIFO inventory batches.
            </p>
          </div>
          <Link
            to="/login"
            className="primary-btn"
            style={{ textDecoration: "none", padding: "8px 18px", fontSize: "12px" }}
          >
            Go to Login Page →
          </Link>
        </div>
      )}

      {/* SUCCESS NOTIFICATION */}
      {resultNotice && (
        <div
          style={{
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            borderRadius: "9px",
            padding: "16px 18px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            boxShadow: "0 2px 6px rgba(16, 185, 129, 0.08)",
          }}
        >
          <CheckCircle2 size={22} style={{ color: "#10b981", flexShrink: 0, marginTop: "2px" }} />
          <div style={{ flex: 1 }}>
            <b style={{ color: "#065f46", fontSize: "13px", display: "block" }}>
              Goods Receipt Successfully Allocated to FIFO Stock!
            </b>
            <p style={{ color: "#047857", fontSize: "12px", margin: "4px 0 0" }}>
              {resultNotice.message} Total <b>{resultNotice.total_accepted_quantity} units</b> accepted and converted into active FIFO inventory batches. Technicians can now issue these parts to repair jobs at this verified batch rate.
            </p>
          </div>
          <button
            onClick={() => setResultNotice(null)}
            style={{ border: 0, background: "transparent", color: "#047857", cursor: "pointer", fontSize: "16px" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ERROR NOTIFICATION */}
      {errorNotice && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "9px",
            padding: "16px 18px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
          }}
        >
          <AlertTriangle size={22} style={{ color: "#ef4444", flexShrink: 0, marginTop: "2px" }} />
          <div style={{ flex: 1 }}>
            <b style={{ color: "#991b1b", fontSize: "13px", display: "block" }}>
              Inwarding Notification
            </b>
            <p style={{ color: "#b91c1c", fontSize: "12px", margin: "4px 0 0" }}>
              {errorNotice}
            </p>
          </div>
          <button
            onClick={() => setErrorNotice(null)}
            style={{ border: 0, background: "transparent", color: "#991b1b", cursor: "pointer", fontSize: "16px" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 4 KPI METRIC CARDS */}
      <div className="responsive-grid-4" style={{ marginBottom: "22px" }}>
        <div className="stat-card">
          <div className="stat-icon Blue">
            <PackageCheck size={18} />
          </div>
          <div className="stat-label">Total Receipts (GRN)</div>
          <div className="stat-value">{receiptsList.length}</div>
          <div className="stat-foot">Consignments recorded</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon Orange">
            <Clock size={18} />
          </div>
          <div className="stat-label">Pending Inwarding</div>
          <div className="stat-value">{pendingReceipts.length}</div>
          <div className="stat-foot">Awaiting FIFO batch creation</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon Green">
            <Layers size={18} />
          </div>
          <div className="stat-label">Allocated to FIFO</div>
          <div className="stat-value">{processedReceipts.length}</div>
          <div className="stat-foot">Active in inventory ledger</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon Purple">
            <Building2 size={18} />
          </div>
          <div className="stat-label">Active Suppliers</div>
          <div className="stat-value">{uniqueSuppliers}</div>
          <div className="stat-foot">Verified parts vendors</div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="tabs-nav" style={{ marginBottom: "18px" }}>
        <button
          className={activeTab === "pending" ? "primary-btn" : "secondary-btn"}
          onClick={() => setActiveTab("pending")}
          style={{ borderRadius: "8px" }}
        >
          <Clock size={15} /> Pending Inwarding ({pendingReceipts.length})
        </button>

        <button
          className={activeTab === "processed" ? "primary-btn" : "secondary-btn"}
          onClick={() => setActiveTab("processed")}
          style={{ borderRadius: "8px" }}
        >
          <CheckCircle2 size={15} /> Inwarded FIFO Receipts ({processedReceipts.length})
        </button>

        <button
          className={activeTab === "all" ? "primary-btn" : "secondary-btn"}
          onClick={() => setActiveTab("all")}
          style={{ borderRadius: "8px" }}
        >
          <PackageCheck size={15} /> All Receipts ({receiptsList.length})
        </button>
      </div>

      {/* MAIN DATA PANEL */}
      <div className="panel">
        <div className="section-head">
          <div>
            <h2>
              {activeTab === "pending"
                ? "Pending Goods Inwarding (Action Required)"
                : activeTab === "processed"
                ? "Inwarded FIFO Batches (Processed History)"
                : "All Workshop Goods Receipts"}
            </h2>
            <p>
              {activeTab === "pending"
                ? "Review verified deliveries and convert accepted quantities into active FIFO batches"
                : "Historical audit ledger of deliveries processed into shop inventory"}
            </p>
          </div>
          <span className="count">{currentList.length} receipt notes</span>
        </div>

        {/* Desktop Table */}
        <div className="table-wrap desktop-grntest-table">
          <table>
            <thead>
              <tr>
                <th>GRN Number</th>
                <th>PO Reference</th>
                <th>Supplier</th>
                <th>Received Date</th>
                <th>Stock Ledger Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="empty">
                    Loading goods receipts from database…
                  </td>
                </tr>
              ) : currentList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    {activeTab === "pending"
                      ? "All supplier deliveries have been allocated to FIFO stock! New receipts created in Procurement will appear here."
                      : "No goods receipts found in this category."}
                  </td>
                </tr>
              ) : (
                currentList.map((receipt) => {
                  const isProcessingThis = isProcessing && processingId === receipt.id;
                  const isTest = receipt.is_test_receipt || receipt.grn_number?.toUpperCase() === "TEST-GRN-001";

                  return (
                    <tr key={receipt.id}>
                      {/* GRN Number */}
                      <td>
                        <b style={{ color: "#0176d3" }}>
                          <code>{receipt.grn_number || receipt.id.slice(0, 8)}</code>
                        </b>
                        {isTest && (
                          <span
                            className="tag"
                            style={{
                              background: "#e8f8f0",
                              color: "#15945b",
                              marginLeft: "6px",
                              fontSize: "9px",
                              fontWeight: 700,
                            }}
                          >
                            BASELINE GRN
                          </span>
                        )}
                        {receipt.notes && (
                          <small style={{ display: "block", color: "#8292a8", fontSize: "10px", marginTop: "2px" }}>
                            {receipt.notes}
                          </small>
                        )}
                      </td>

                      {/* PO Number */}
                      <td>
                        {receipt.po_number ? (
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>
                            PO #{receipt.po_number}
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>Direct Consignment</span>
                        )}
                      </td>

                      {/* Supplier */}
                      <td>
                        <b style={{ color: "#334155" }}>
                          {receipt.supplier_name || "Authorized Parts Supplier"}
                        </b>
                      </td>

                      {/* Received Date */}
                      <td>
                        {receipt.received_date ? (
                          <span>
                            {new Date(receipt.received_date).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>

                      {/* Ledger Status */}
                      <td>
                        {receipt.is_processed ? (
                          <span
                            className="tag"
                            style={{
                              background: "#e8f8f0",
                              color: "#15945b",
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <CheckCircle2 size={12} />
                            Allocated in FIFO
                          </span>
                        ) : (
                          <span
                            className="tag"
                            style={{
                              background: "#fef3c7",
                              color: "#92400e",
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Clock size={12} />
                            Pending Inwarding
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                          <button
                            type="button"
                            className="secondary-btn"
                            style={{ padding: "6px 10px", fontSize: "11px" }}
                            onClick={() => handleViewReceipt(receipt)}
                          >
                            <Eye size={13} />
                            Items
                          </button>

                          {!receipt.is_processed ? (
                            <button
                              type="button"
                              className="primary-btn"
                              style={{ padding: "6px 12px", fontSize: "11px" }}
                              onClick={() => handleProcessReceipt(receipt)}
                              disabled={isProcessingThis || !isAuthorizedForFifo}
                              title={
                                isAuthorizedForFifo
                                  ? "Allocate accepted quantities into FIFO inventory batches"
                                  : "Only Manager/Inventory roles can allocate stock"
                              }
                            >
                              <Layers size={13} />
                              {isProcessingThis ? "Allocating..." : "Inward to FIFO"}
                            </button>
                          ) : (
                            <span
                              style={{
                                fontSize: "11px",
                                color: "#16a34a",
                                fontWeight: 600,
                                padding: "6px 8px",
                              }}
                            >
                              Inwarded ✓
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Touch-Friendly GRN Receipt Cards */}
        <div className="mobile-grntest-cards">
          {loading ? (
            <div style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
              Loading goods receipts from database…
            </div>
          ) : currentList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px", color: "#64748b", background: "#f8fafc", borderRadius: "8px" }}>
              {activeTab === "pending"
                ? "All supplier deliveries have been allocated to FIFO stock! New receipts created in Procurement will appear here."
                : "No goods receipts found in this category."}
            </div>
          ) : (
            currentList.map((receipt) => {
              const isProcessingThis = isProcessing && processingId === receipt.id;
              const isTest = receipt.is_test_receipt || receipt.grn_number?.toUpperCase() === "TEST-GRN-001";

              return (
                <div key={receipt.id} className="mobile-grntest-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <b style={{ color: "#0176d3", fontSize: "14px" }}>
                        <code>{receipt.grn_number || receipt.id.slice(0, 8)}</code>
                      </b>
                      {isTest && (
                        <span className="tag" style={{ background: "#e8f8f0", color: "#15945b", marginLeft: "6px", fontSize: "9px", fontWeight: 700 }}>
                          BASELINE GRN
                        </span>
                      )}
                      <div style={{ fontSize: "12.5px", color: "#1e293b", fontWeight: 600, marginTop: "2px" }}>
                        {receipt.supplier_name || "Authorized Parts Supplier"}
                      </div>
                    </div>
                    {receipt.is_processed ? (
                      <span className="tag" style={{ background: "#e8f8f0", color: "#15945b", fontWeight: 700, fontSize: "10.5px" }}>
                        <CheckCircle2 size={11} style={{ marginRight: 3 }} /> Allocated
                      </span>
                    ) : (
                      <span className="tag" style={{ background: "#fef3c7", color: "#92400e", fontWeight: 700, fontSize: "10.5px" }}>
                        <Clock size={11} style={{ marginRight: 3 }} /> Pending Inward
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "#64748b", background: "#f8fafc", padding: "8px 10px", borderRadius: "6px" }}>
                    <span>Ref: <b>{receipt.po_number ? `PO #${receipt.po_number}` : "Direct Consignment"}</b></span>
                    <span>
                      {receipt.received_date ? new Date(receipt.received_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </span>
                  </div>

                  {receipt.notes && (
                    <div style={{ fontSize: "10.5px", color: "#8292a8", fontStyle: "italic" }}>
                      {receipt.notes}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "8px", alignItems: "center", paddingTop: "8px", borderTop: "1px dashed #e2e8f0" }}>
                    <button
                      type="button"
                      className="secondary-btn"
                      style={{ padding: "6px 10px", fontSize: "11.5px", flex: 1, justifyContent: "center" }}
                      onClick={() => handleViewReceipt(receipt)}
                    >
                      <Eye size={13} /> View Items
                    </button>

                    {!receipt.is_processed ? (
                      <button
                        type="button"
                        className="primary-btn"
                        style={{ padding: "6px 12px", fontSize: "11.5px", flex: 1, justifyContent: "center" }}
                        onClick={() => handleProcessReceipt(receipt)}
                        disabled={isProcessingThis || !isAuthorizedForFifo}
                      >
                        <Layers size={13} />
                        {isProcessingThis ? "Allocating..." : "Inward to FIFO"}
                      </button>
                    ) : (
                      <span style={{ fontSize: "11px", color: "#16a34a", fontWeight: 600, padding: "6px 10px", textAlign: "center" }}>
                        Inwarded ✓
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL: VIEW GRN ITEMS & BREAKDOWN */}
      {selectedViewReceipt && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: "680px" }}>
            <div className="modal-head">
              <div>
                <span className="tag" style={{ background: "#edf5fc", color: "#0176d3", fontWeight: 700 }}>
                  GRN #{selectedViewReceipt.grn_number || selectedViewReceipt.id.slice(0, 8)}
                </span>
                <h2 style={{ marginTop: "6px" }}>Delivery Consignment Breakdown</h2>
                <p>
                  PO Reference: <b>{selectedViewReceipt.po_number || "Direct Consignment"}</b> | Supplier: <b>{selectedViewReceipt.supplier_name || "Vendor"}</b>
                </p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setSelectedViewReceipt(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Receipt Summary Strip */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "10px",
                background: "#f8fafc",
                padding: "12px 14px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                marginBottom: "16px",
              }}
            >
              <div>
                <small style={{ fontSize: "10px", color: "#64748b" }}>Received Date</small>
                <b style={{ display: "block", fontSize: "13px" }}>
                  {selectedViewReceipt.received_date
                    ? new Date(selectedViewReceipt.received_date).toLocaleDateString("en-IN")
                    : "—"}
                </b>
              </div>

              <div>
                <small style={{ fontSize: "10px", color: "#64748b" }}>Status</small>
                <b
                  style={{
                    display: "block",
                    fontSize: "13px",
                    color: selectedViewReceipt.is_processed ? "#15945b" : "#e68a2e",
                  }}
                >
                  {selectedViewReceipt.is_processed ? "Allocated in FIFO ✓" : "Pending Inwarding"}
                </b>
              </div>

              <div>
                <small style={{ fontSize: "10px", color: "#64748b" }}>Items Count</small>
                <b style={{ display: "block", fontSize: "13px" }}>
                  {receiptItems.length} line items
                </b>
              </div>
            </div>

            {/* Items Table */}
            <div style={{ marginBottom: "18px" }}>
              <h4 style={{ fontSize: "12px", color: "#1e293b", margin: "0 0 10px", fontWeight: 700 }}>
                Consignment Items & Inspection Count:
              </h4>

              <div className="table-wrap" style={{ border: "1px solid #e7edf5", borderRadius: "8px" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Spare Part / SKU</th>
                      <th style={{ textAlign: "center" }}>Received</th>
                      <th style={{ textAlign: "center" }}>Accepted (FIFO)</th>
                      <th style={{ textAlign: "center" }}>Rejected</th>
                      <th style={{ textAlign: "right" }}>Unit Cost</th>
                      <th style={{ textAlign: "right" }}>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsLoading ? (
                      <tr>
                        <td colSpan={6} className="empty">
                          Loading item details…
                        </td>
                      </tr>
                    ) : receiptItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="empty">
                          No item records stored for this receipt note.
                        </td>
                      </tr>
                    ) : (
                      receiptItems.map((item, idx) => {
                        const lineTotal = item.accepted_quantity * item.unit_cost;
                        return (
                          <tr key={item.id || idx}>
                            <td>
                              <b>{item.part_name}</b>
                              <small style={{ display: "block", color: "#8292a8", fontSize: "10px" }}>
                                SKU: {item.sku}
                              </small>
                            </td>
                            <td style={{ textAlign: "center" }}>{item.received_quantity}</td>
                            <td style={{ textAlign: "center", color: "#15945b", fontWeight: 700 }}>
                              {item.accepted_quantity}
                            </td>
                            <td style={{ textAlign: "center", color: item.rejected_quantity > 0 ? "#dc2626" : "#64748b" }}>
                              {item.rejected_quantity}
                            </td>
                            <td style={{ textAlign: "right" }}>
                              ₹{item.unit_cost.toLocaleString("en-IN")}
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 700, color: "#1e293b" }}>
                              ₹{lineTotal.toLocaleString("en-IN")}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setSelectedViewReceipt(null)}
              >
                Close
              </button>

              {!selectedViewReceipt.is_processed && (
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => handleProcessReceipt(selectedViewReceipt)}
                  disabled={isProcessing || !isAuthorizedForFifo}
                >
                  <Layers size={15} />
                  {isProcessing ? "Allocating to FIFO..." : "Confirm & Inward to FIFO Stock"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
