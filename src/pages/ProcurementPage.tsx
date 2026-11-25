import React, { useState, useEffect } from "react";
import {
  Truck,
  Plus,
  Search,
  RefreshCw,
  ShoppingCart,
  PackageCheck,
  Building2,
  FileText,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Edit2,
  Trash2,
  Layers,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  getGoodsReceipts,
} from "../lib/procurement";
import { getSpareParts } from "../lib/inventory";
import type { Supplier, PurchaseOrder, GoodsReceipt, Part } from "../lib/types";

export default function ProcurementPage() {
  const [activeTab, setActiveTab] = useState<"orders" | "suppliers" | "grn">("orders");
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [grns, setGrns] = useState<GoodsReceipt[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modals
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [showCreatePo, setShowCreatePo] = useState(false);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);

  // Supplier Form
  const [supName, setSupName] = useState("");
  const [supContact, setSupContact] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supEmail, setSupEmail] = useState("");
  const [supAddress, setSupAddress] = useState("");

  // Edit Supplier Form
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editSupName, setEditSupName] = useState("");
  const [editSupContact, setEditSupContact] = useState("");
  const [editSupPhone, setEditSupPhone] = useState("");
  const [editSupEmail, setEditSupEmail] = useState("");
  const [editSupAddress, setEditSupAddress] = useState("");

  // PO Form
  const [poNumber, setPoNumber] = useState("");
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poNotes, setPoNotes] = useState("");
  const [poLines, setPoLines] = useState<Array<{ spare_part_id: string; ordered_quantity: number; unit_cost: number }>>([
    { spare_part_id: "", ordered_quantity: 10, unit_cost: 1000 },
  ]);

  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [orderList, supList, grnList, partList] = await Promise.all([
        getPurchaseOrders(),
        getSuppliers(),
        getGoodsReceipts(),
        getSpareParts(),
      ]);
      setOrders(orderList);
      setSuppliers(supList);
      setGrns(grnList);
      setParts(partList);
    } catch (err: any) {
      setError(err?.message || "Failed to load procurement data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [activeTab]);

  async function handleAddSupplier(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createSupplier({
        supplier_name: supName.trim(),
        contact_name: supContact.trim() || null,
        phone: supPhone.trim() || null,
        email: supEmail.trim() || null,
        address: supAddress.trim() || null,
      });
      setShowAddSupplier(false);
      setSuccess(`Supplier "${supName}" registered successfully.`);
      setSupName("");
      setSupContact("");
      setSupPhone("");
      setSupEmail("");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to register supplier");
    } finally {
      setSubmitting(false);
    }
  }

  function startEditSupplier(sup: Supplier) {
    setEditingSupplier(sup);
    setEditSupName(sup.supplier_name);
    setEditSupContact(sup.contact_person || sup.contact_name || "");
    setEditSupPhone(sup.phone || "");
    setEditSupEmail(sup.email || "");
    setEditSupAddress(sup.address || "");
  }

  async function handleUpdateSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSupplier) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateSupplier(editingSupplier.id, {
        supplier_name: editSupName.trim(),
        contact_person: editSupContact.trim() || undefined,
        phone: editSupPhone.trim() || undefined,
        email: editSupEmail.trim() || undefined,
        address: editSupAddress.trim() || undefined,
      });
      setEditingSupplier(null);
      setSuccess(`Supplier "${editSupName}" updated successfully.`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to update supplier");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteSupplier(id: string, name: string) {
    if (!window.confirm(`Are you sure you want to delete supplier "${name}"?`)) {
      return;
    }
    setError(null);
    try {
      await deleteSupplier(id);
      setSuccess(`Supplier "${name}" deleted.`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to delete supplier");
    }
  }

  async function handlePoStatusChange(poId: string, newStatus: string) {
    setError(null);
    try {
      await updatePurchaseOrderStatus(poId, newStatus);
      setSuccess(`Purchase Order status updated to "${newStatus}".`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to update PO status");
    }
  }

  function addPoLine() {
    setPoLines([...poLines, { spare_part_id: "", ordered_quantity: 10, unit_cost: 500 }]);
  }

  function removePoLine(index: number) {
    setPoLines(poLines.filter((_, i) => i !== index));
  }

  function updatePoLine(index: number, field: string, value: any) {
    const updated = [...poLines];
    (updated[index] as any)[field] = value;
    if (field === "spare_part_id") {
      const selectedPart = parts.find((p) => p.id === value);
      if (selectedPart) {
        updated[index].unit_cost = selectedPart.unit_cost || 0;
      }
    }
    setPoLines(updated);
  }

  async function handleCreatePo(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const validLines = poLines.filter((l) => l.spare_part_id && l.ordered_quantity > 0);
      if (validLines.length === 0) {
        throw new Error("Please add at least one valid spare part line item with quantity > 0.");
      }

      await createPurchaseOrder(
        {
          po_number: poNumber.trim() || `PO-${Date.now().toString().slice(-6)}`,
          supplier_id: poSupplierId,
          notes: poNotes.trim() || undefined,
        },
        validLines
      );

      setShowCreatePo(false);
      setSuccess("Purchase Order created.");
      setPoNumber("");
      setPoNotes("");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to create Purchase Order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">PROCUREMENT & PURCHASING</div>
          <h1>Procurement, Suppliers & POs</h1>
          <p>Vendor directory, Purchase Orders creation, goods receipt tracking and FIFO allocation.</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link to="/fifo-test" className="secondary-btn" style={{ textDecoration: "none" }}>
            <PackageCheck size={16} /> Test Goods Receipt FIFO
          </Link>
          <button className="secondary-btn" onClick={() => setShowAddSupplier(true)}>
            <Building2 size={16} /> Add Supplier
          </button>
          <button className="primary-btn" onClick={() => setShowCreatePo(true)}>
            <Plus size={16} /> Create Purchase Order
          </button>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}
      {success && (
        <div className="notice" style={{ background: "#e8f8f0", color: "#15945b", display: "flex", gap: "8px", alignItems: "center" }}>
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {/* Tabs */}
      <div className="sub-tabs-ribbon" style={{ marginBottom: "16px" }}>
        <button
          className={activeTab === "orders" ? "primary-btn" : "secondary-btn"}
          onClick={() => setActiveTab("orders")}
        >
          <FileText size={15} /> Purchase Orders ({orders.length})
        </button>
        <button
          className={activeTab === "suppliers" ? "primary-btn" : "secondary-btn"}
          onClick={() => setActiveTab("suppliers")}
        >
          <Building2 size={15} /> Suppliers ({suppliers.length})
        </button>
        <button
          className={activeTab === "grn" ? "primary-btn" : "secondary-btn"}
          onClick={() => setActiveTab("grn")}
        >
          <PackageCheck size={15} /> Goods Receipts ({grns.length})
        </button>
      </div>

      {/* TAB 1: PURCHASE ORDERS */}
      {activeTab === "orders" && (
        <div className="panel">
          <div className="panel-toolbar">
            <button className="icon-btn" onClick={loadData} title="Refresh">
              <RefreshCw size={16} />
            </button>
            <span className="count">{orders.length} purchase orders</span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Supplier</th>
                  <th>Items Count</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th>Order Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="empty">Loading purchase orders…</td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty">No purchase orders found. Click "Create Purchase Order" to begin.</td>
                  </tr>
                ) : (
                  orders.map((po) => (
                    <tr key={po.id}>
                      <td><b><code>{po.po_number}</code></b></td>
                      <td>{po.supplier_name}</td>
                      <td>{po.items?.length || 0} line items</td>
                      <td><b>₹{po.total_amount.toLocaleString("en-IN")}</b></td>
                      <td>
                        <span
                          className="tag"
                          style={{
                            background: po.status === "received" ? "#e8f8f0" : "#fff8e7",
                            color: po.status === "received" ? "#15945b" : "#805b16",
                            textTransform: "capitalize",
                            fontWeight: 700,
                          }}
                        >
                          {po.status}
                        </span>
                      </td>
                      <td>{new Date(po.created_at).toLocaleDateString("en-IN")}</td>
                      <td>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <select
                            value={po.status}
                            onChange={(e) => handlePoStatusChange(po.id, e.target.value)}
                            style={{
                              height: "28px",
                              border: "1px solid #e0e7ef",
                              borderRadius: "5px",
                              padding: "0 6px",
                              fontSize: "11px",
                              background: "#fff",
                            }}
                          >
                            <option value="ordered">Ordered</option>
                            <option value="partially_received">Partially Received</option>
                            <option value="received">Received</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                          <button
                            className="secondary-btn"
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            onClick={() => setSelectedPo(po)}
                          >
                            View Lines
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SUPPLIERS */}
      {activeTab === "suppliers" && (
        <div className="panel">
          <div className="panel-toolbar">
            <button className="icon-btn" onClick={loadData} title="Refresh">
              <RefreshCw size={16} />
            </button>
            <span className="count">{suppliers.length} suppliers</span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Supplier Name</th>
                  <th>Contact Person</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Address</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="empty">Loading suppliers…</td>
                  </tr>
                ) : suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty">No suppliers registered. Click "Add Supplier" to add one.</td>
                  </tr>
                ) : (
                  suppliers.map((s) => (
                    <tr key={s.id}>
                      <td><b>{s.supplier_name}</b></td>
                      <td>{s.contact_person || s.contact_name || "—"}</td>
                      <td><code>{s.phone || "—"}</code></td>
                      <td>{s.email || "—"}</td>
                      <td>{s.address || "—"}</td>
                      <td>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <button
                            className="secondary-btn"
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            onClick={() => startEditSupplier(s)}
                            title="Edit Supplier"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            className="secondary-btn"
                            style={{ padding: "4px 8px", fontSize: "11px", color: "#b42318", borderColor: "#fecaca" }}
                            onClick={() => handleDeleteSupplier(s.id, s.supplier_name)}
                            title="Delete Supplier"
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
        </div>
      )}

      {/* TAB 3: GOODS RECEIPTS */}
      {activeTab === "grn" && (
        <div className="panel">
          <div className="panel-toolbar">
            <button className="icon-btn" onClick={loadData} title="Refresh">
              <RefreshCw size={16} />
            </button>
            <span className="count">{grns.length} goods receipt notes</span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>GRN Number</th>
                  <th>PO Reference</th>
                  <th>Supplier</th>
                  <th>Received Date</th>
                  <th>Ledger Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="empty">Loading goods receipts…</td>
                  </tr>
                ) : grns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty">No Goods Receipts found.</td>
                  </tr>
                ) : (
                  grns.map((g) => {
                    const isTest = g.is_test_receipt || g.grn_number?.toUpperCase() === "TEST-GRN-001";
                    return (
                      <tr key={g.id}>
                        <td>
                          <b><code>{g.grn_number || g.id.slice(0, 8)}</code></b>
                          {isTest && (
                            <span className="tag" style={{ background: "#e8f8f0", color: "#15945b", marginLeft: 6, fontSize: "9px" }}>
                              TEST GRN
                            </span>
                          )}
                        </td>
                        <td>{g.po_number || "—"}</td>
                        <td>{g.supplier_name || "—"}</td>
                        <td>{g.received_date ? new Date(g.received_date).toLocaleDateString("en-IN") : "—"}</td>
                        <td>
                          {g.is_processed ? (
                            <span className="tag" style={{ background: "#fef3c7", color: "#92400e", fontWeight: 700 }}>
                              Processed into FIFO
                            </span>
                          ) : (
                            <span className="tag" style={{ background: "#e8f8f0", color: "#15945b", fontWeight: 700 }}>
                              Pending Allocation
                            </span>
                          )}
                        </td>
                        <td>
                          <Link
                            to="/goods-receipts"
                            className="secondary-btn"
                            style={{ padding: "5px 10px", fontSize: "11px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            <Layers size={13} />
                            Inward to FIFO
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD SUPPLIER */}
      {showAddSupplier && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleAddSupplier}>
            <div className="modal-head">
              <div>
                <h2>Register New Supplier</h2>
                <p>Add phone/parts vendor contact information</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowAddSupplier(false)}>×</button>
            </div>

            <div className="form-grid">
              <label>
                Supplier / Company Name *
                <input required placeholder="e.g. Apex Mobile Spares Ltd" value={supName} onChange={(e) => setSupName(e.target.value)} />
              </label>
              <label>
                Contact Person
                <input placeholder="e.g. Rajesh Kumar" value={supContact} onChange={(e) => setSupContact(e.target.value)} />
              </label>
              <label>
                Phone Number
                <input placeholder="+91 98765 43210" value={supPhone} onChange={(e) => setSupPhone(e.target.value)} />
              </label>
              <label>
                Email Address
                <input type="email" placeholder="orders@apexspares.com" value={supEmail} onChange={(e) => setSupEmail(e.target.value)} />
              </label>
            </div>

            <div style={{ marginTop: "12px" }}>
              <label style={{ fontSize: "10px", color: "#687b92", display: "grid", gap: "6px" }}>
                Address / Warehouse City
                <input placeholder="Lamington Road, Mumbai" value={supAddress} onChange={(e) => setSupAddress(e.target.value)} style={{ border: "1px solid #e0e7ef", borderRadius: "6px", height: "36px", padding: "0 10px", fontSize: "12px" }} />
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setShowAddSupplier(false)}>Cancel</button>
              <button className="primary-btn" disabled={submitting}>
                {submitting ? "Saving..." : "Save Supplier"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: CREATE PURCHASE ORDER */}
      {showCreatePo && (
        <div className="modal-backdrop">
          <form className="modal" style={{ maxWidth: "680px" }} onSubmit={handleCreatePo}>
            <div className="modal-head">
              <div>
                <h2>Create Purchase Order</h2>
                <p>Select supplier and add spare parts line items</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowCreatePo(false)}>×</button>
            </div>

            <div className="form-grid">
              <label>
                PO Number (e.g. PO-2026-001)
                <input placeholder="Auto-generated if blank" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
              </label>
              <label>
                Supplier *
                <select required value={poSupplierId} onChange={(e) => setPoSupplierId(e.target.value)}>
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.supplier_name}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Line Items */}
            <div style={{ marginTop: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <b style={{ fontSize: "12px", color: "#152b49" }}>Order Line Items</b>
                <button type="button" className="secondary-btn" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={addPoLine}>
                  <Plus size={13} /> Add Line
                </button>
              </div>

              <div style={{ display: "grid", gap: "8px" }}>
                {poLines.map((line, idx) => (
                  <div key={idx} className="po-line-item" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: "8px", alignItems: "end", background: "#f8fafc", padding: "8px", borderRadius: "6px" }}>
                    <label style={{ fontSize: "10px", color: "#687b92", display: "grid", gap: "3px" }}>
                      Spare Part SKU
                      <select required value={line.spare_part_id} onChange={(e) => updatePoLine(idx, "spare_part_id", e.target.value)} style={{ height: "34px", fontSize: "11px" }}>
                        <option value="">-- Select SKU --</option>
                        {parts.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                        ))}
                      </select>
                    </label>

                    <label style={{ fontSize: "10px", color: "#687b92", display: "grid", gap: "3px" }}>
                      Quantity
                      <input type="number" min="1" required value={line.ordered_quantity} onChange={(e) => updatePoLine(idx, "ordered_quantity", Number(e.target.value))} style={{ height: "34px", fontSize: "11px" }} />
                    </label>

                    <label style={{ fontSize: "10px", color: "#687b92", display: "grid", gap: "3px" }}>
                      Unit Cost (₹)
                      <input type="number" min="0" required value={line.unit_cost} onChange={(e) => updatePoLine(idx, "unit_cost", Number(e.target.value))} style={{ height: "34px", fontSize: "11px" }} />
                    </label>

                    {poLines.length > 1 && (
                      <button type="button" className="icon-btn" onClick={() => removePoLine(idx)} style={{ width: "32px", height: "34px", color: "#b42318" }}>×</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: "16px" }}>
              <button type="button" className="secondary-btn" onClick={() => setShowCreatePo(false)}>Cancel</button>
              <button className="primary-btn" disabled={submitting || !poSupplierId}>
                {submitting ? "Creating..." : "Save Purchase Order"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: VIEW PO LINES */}
      {selectedPo && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: "600px" }}>
            <div className="modal-head">
              <div>
                <h2>{selectedPo.po_number} Details</h2>
                <p>Supplier: <b>{selectedPo.supplier_name}</b> | Status: {selectedPo.status}</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setSelectedPo(null)}>×</button>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Part Name / SKU</th>
                    <th>Ordered Qty</th>
                    <th>Unit Cost</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedPo.items || []).map((item) => (
                    <tr key={item.id}>
                      <td><b>{item.part_name || "Part"}</b> ({item.sku})</td>
                      <td>{item.ordered_quantity}</td>
                      <td>₹{item.unit_cost.toLocaleString("en-IN")}</td>
                      <td>₹{(item.ordered_quantity * item.unit_cost).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: "14px", textAlign: "right" }}>
              <span style={{ fontSize: "13px", color: "#687b92" }}>Total PO Value: </span>
              <b style={{ fontSize: "18px", color: "#152b49" }}>₹{selectedPo.total_amount.toLocaleString("en-IN")}</b>
            </div>

            <div className="modal-actions" style={{ marginTop: "16px" }}>
              <button type="button" className="secondary-btn" onClick={() => setSelectedPo(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT SUPPLIER */}
      {editingSupplier && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleUpdateSupplier}>
            <div className="modal-head">
              <div>
                <h2>Edit Supplier Profile</h2>
                <p>Modify vendor name, contact person or communication details</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setEditingSupplier(null)}>×</button>
            </div>

            <div className="form-grid">
              <label>
                Supplier / Company Name *
                <input required value={editSupName} onChange={(e) => setEditSupName(e.target.value)} />
              </label>
              <label>
                Contact Person
                <input value={editSupContact} onChange={(e) => setEditSupContact(e.target.value)} />
              </label>
              <label>
                Phone Number
                <input value={editSupPhone} onChange={(e) => setEditSupPhone(e.target.value)} />
              </label>
              <label>
                Email Address
                <input type="email" value={editSupEmail} onChange={(e) => setEditSupEmail(e.target.value)} />
              </label>
            </div>

            <div style={{ marginTop: "12px" }}>
              <label style={{ fontSize: "10px", color: "#687b92", display: "grid", gap: "6px" }}>
                Address / Warehouse City
                <input
                  value={editSupAddress}
                  onChange={(e) => setEditSupAddress(e.target.value)}
                  style={{ border: "1px solid #e0e7ef", borderRadius: "6px", height: "36px", padding: "0 10px", fontSize: "12px" }}
                />
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setEditingSupplier(null)}>Cancel</button>
              <button className="primary-btn" disabled={submitting}>
                {submitting ? "Saving..." : "Update Supplier"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
