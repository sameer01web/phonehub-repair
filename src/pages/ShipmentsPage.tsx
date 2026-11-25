import React, { useState, useEffect } from "react";
import { Package, Plus, Search, RefreshCw, Calendar, Truck, ArrowRight, Smartphone, Edit2, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { getShipments, createShipment, updateShipment, deleteShipment, getDevices } from "../lib/repairs";
import type { Shipment, Device } from "../lib/types";

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Modal State
  const [showAdd, setShowAdd] = useState(false);
  const [code, setCode] = useState("");
  const [supplier, setSupplier] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit Modal State
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editSupplier, setEditSupplier] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Details
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [shipmentDevices, setShipmentDevices] = useState<Device[]>([]);

  async function loadShipments() {
    setLoading(true);
    setError(null);
    try {
      setShipments(await getShipments());
    } catch (err: any) {
      setError(err?.message || "Failed to load shipments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShipments();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createShipment({
        shipment_code: code.trim(),
        supplier_name: supplier.trim() || undefined,
        received_date: date,
        notes: notes.trim() || undefined,
      });
      setShowAdd(false);
      setCode("");
      setSupplier("");
      setNotes("");
      await loadShipments();
    } catch (err: any) {
      setError(err?.message || "Failed to create shipment");
    } finally {
      setSubmitting(false);
    }
  }

  function startEditShipment(ship: Shipment) {
    setEditingShipment(ship);
    setEditCode(ship.shipment_code || ship.tracking_number || "");
    setEditSupplier(ship.supplier_name || "");
    setEditDate(ship.received_date ? ship.received_date.split("T")[0] : "");
    setEditNotes(ship.notes || "");
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingShipment) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateShipment(editingShipment.id, {
        tracking_number: editCode.trim(),
        supplier_name: editSupplier.trim() || undefined,
        received_date: editDate || undefined,
        notes: editNotes.trim() || undefined,
      });
      setEditingShipment(null);
      await loadShipments();
    } catch (err: any) {
      setError(err?.message || "Failed to update shipment");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string, code: string) {
    if (!window.confirm(`Are you sure you want to delete shipment lot "${code}"? Any associated handsets will remain in inventory.`)) {
      return;
    }
    setError(null);
    try {
      await deleteShipment(id);
      await loadShipments();
    } catch (err: any) {
      setError(err?.message || "Failed to delete shipment");
    }
  }

  async function viewShipmentDetails(ship: Shipment) {
    setSelectedShipment(ship);
    try {
      const allDevices = await getDevices();
      setShipmentDevices(allDevices.filter((d) => d.shipment_id === ship.id));
    } catch {
      setShipmentDevices([]);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">LOGISTICS & INTAKE</div>
          <h1>Shipments & Lots</h1>
          <p>Register incoming lots, manage supplier consignments, and group received handsets.</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link to="/fifo-test" className="secondary-btn" style={{ textDecoration: "none" }}>
            <Package size={15} /> Goods Receipt FIFO
          </Link>
          <button className="primary-btn" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> Register Shipment Lot
          </button>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}

      <div className="panel">
        <div className="panel-toolbar">
          <button className="icon-btn" onClick={loadShipments} title="Refresh">
            <RefreshCw size={16} />
          </button>
          <span className="count">{shipments.length} shipment lots registered</span>
        </div>

        <div className="table-wrap desktop-shipments-table">
          <table>
            <thead>
              <tr>
                <th>Lot / Shipment Code</th>
                <th>Supplier</th>
                <th>Received Date</th>
                <th>Handsets Count</th>
                <th>Notes</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="empty">Loading shipment lots…</td>
                </tr>
              ) : shipments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">No shipments registered yet. Click "Register Shipment Lot" to start.</td>
                </tr>
              ) : (
                shipments.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <b style={{ color: "#0176d3" }}>{s.shipment_code}</b>
                    </td>
                    <td>{s.supplier_name || "Unspecified"}</td>
                    <td>{new Date(s.received_date).toLocaleDateString("en-IN")}</td>
                    <td>
                      <span className="tag" style={{ background: "#f1f7fd", color: "#1680d0", fontWeight: 700 }}>
                        <Smartphone size={12} style={{ display: "inline", marginRight: 3 }} />
                        {s.device_count || 0} phones
                      </span>
                    </td>
                    <td style={{ maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {s.notes || "—"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <button
                          className="secondary-btn"
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                          onClick={() => viewShipmentDetails(s)}
                        >
                          Handsets
                        </button>
                        <button
                          className="secondary-btn"
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                          onClick={() => startEditShipment(s)}
                          title="Edit lot details"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          className="secondary-btn"
                          style={{ padding: "4px 8px", fontSize: "11px", color: "#b42318", borderColor: "#fecaca" }}
                          onClick={() => handleDelete(s.id, s.shipment_code || s.tracking_number || s.id.slice(0, 8))}
                          title="Delete shipment lot"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Touch Cards */}
        <div className="mobile-shipments-cards">
          {shipments.length === 0 ? (
            <div style={{ textAlign: "center", color: "#64748b", padding: "20px" }}>
              No shipments registered yet. Tap "Register Shipment Lot" to start.
            </div>
          ) : (
            shipments.map((s) => (
              <div key={s.id} className="mobile-shipment-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <b style={{ color: "#0176d3", fontSize: "14px" }}>{s.shipment_code}</b>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                      Supplier: <b>{s.supplier_name || "Unspecified"}</b>
                    </div>
                  </div>
                  <span className="tag" style={{ background: "#f1f7fd", color: "#1680d0", fontWeight: 700 }}>
                    <Smartphone size={12} style={{ display: "inline", marginRight: 3 }} />
                    {s.device_count || 0} phones
                  </span>
                </div>

                <div style={{ fontSize: "11px", color: "#64748b" }}>
                  Received: {new Date(s.received_date).toLocaleDateString("en-IN")}
                </div>

                {s.notes && (
                  <div style={{ fontSize: "11.5px", color: "#475569", background: "#f8fafc", padding: "6px 8px", borderRadius: "4px" }}>
                    <b>Notes:</b> {s.notes}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
                  <button
                    className="secondary-btn"
                    style={{ padding: "6px 12px", fontSize: "11.5px" }}
                    onClick={() => viewShipmentDetails(s)}
                  >
                    View Handsets
                  </button>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      className="secondary-btn"
                      style={{ padding: "6px 10px", fontSize: "11.5px" }}
                      onClick={() => startEditShipment(s)}
                      title="Edit lot details"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      className="secondary-btn"
                      style={{ padding: "6px 10px", fontSize: "11.5px", color: "#b42318", borderColor: "#fecaca" }}
                      onClick={() => handleDelete(s.id, s.shipment_code || s.tracking_number || s.id.slice(0, 8))}
                      title="Delete shipment lot"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MODAL: ADD SHIPMENT */}
      {showAdd && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleCreate}>
            <div className="modal-head">
              <div>
                <h2>Register Shipment Lot</h2>
                <p>Record arrival of smartphone lots from suppliers</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowAdd(false)}>×</button>
            </div>

            <div className="form-grid">
              <label>
                Lot / Shipment Code *
                <input
                  required
                  placeholder="e.g. LOT-2026-NOV-01"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <label>
                Supplier Name
                <input
                  placeholder="e.g. Metro Recyclers Ltd"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                />
              </label>
              <label>
                Received Date
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
            </div>

            <div style={{ marginTop: "12px" }}>
              <label style={{ fontSize: "10px", color: "#687b92", display: "grid", gap: "6px" }}>
                Notes / Consignment Details
                <textarea
                  rows={2}
                  placeholder="Expected count, grade mix, package tracking number"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ border: "1px solid #e0e7ef", borderRadius: "6px", padding: "8px", font: "inherit", fontSize: "11px" }}
                />
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="primary-btn" disabled={submitting}>
                {submitting ? "Saving..." : "Create Lot"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: VIEW SHIPMENT PHONES */}
      {selectedShipment && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: "680px" }}>
            <div className="modal-head">
              <div>
                <h2>{selectedShipment.shipment_code} — Handsets</h2>
                <p>Supplier: {selectedShipment.supplier_name || "N/A"} | Date: {selectedShipment.received_date}</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setSelectedShipment(null)}>×</button>
            </div>

            <div className="table-wrap" style={{ maxHeight: "300px", overflowY: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>IMEI 1</th>
                    <th>Condition</th>
                    <th>Status</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {shipmentDevices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty">No devices registered under this shipment lot yet.</td>
                    </tr>
                  ) : (
                    shipmentDevices.map((d) => (
                      <tr key={d.id}>
                        <td><b>{d.brand} {d.model}</b></td>
                        <td><code>{d.imei1 || "—"}</code></td>
                        <td>{d.condition}</td>
                        <td><span className="tag">{d.status}</span></td>
                        <td>₹{d.purchase_cost}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-actions" style={{ marginTop: "14px" }}>
              <button type="button" className="secondary-btn" onClick={() => setSelectedShipment(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT SHIPMENT */}
      {editingShipment && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleUpdate}>
            <div className="modal-head">
              <div>
                <h2>Edit Shipment Lot</h2>
                <p>Update consignment tracking, supplier or intake notes</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setEditingShipment(null)}>×</button>
            </div>

            <div className="form-grid">
              <label>
                Lot / Shipment Code *
                <input
                  required
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                />
              </label>
              <label>
                Supplier Name
                <input
                  value={editSupplier}
                  onChange={(e) => setEditSupplier(e.target.value)}
                />
              </label>
              <label>
                Received Date
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </label>
            </div>

            <div style={{ marginTop: "12px" }}>
              <label style={{ fontSize: "10px", color: "#687b92", display: "grid", gap: "6px" }}>
                Notes / Consignment Details
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  style={{ border: "1px solid #e0e7ef", borderRadius: "6px", padding: "8px", font: "inherit", fontSize: "11px" }}
                />
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setEditingShipment(null)}>Cancel</button>
              <button className="primary-btn" disabled={submitting}>
                {submitting ? "Saving..." : "Update Lot"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
