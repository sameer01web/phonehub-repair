import React, { useState, useEffect } from "react";
import {
  Wrench,
  Plus,
  Search,
  RefreshCw,
  AlertTriangle,
  Layers,
  ArrowDownToLine,
  Sliders,
  History,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  X,
} from "lucide-react";
import {
  getSpareParts,
  createSparePart,
  updateSparePart,
  deleteSparePart,
  getInventoryBatches,
  getStockLedger,
  receiveSparePartFifo,
  recordStockAdjustment,
} from "../lib/inventory";
import type { Part, InventoryBatch, StockLedgerEntry } from "../lib/types";
import CustomSelect from "../components/CustomSelect";

const CATEGORY_OPTIONS = [
  "Display",
  "Battery",
  "Camera",
  "Charging Port",
  "Speaker / Mic",
  "Body / Frame",
  "Motherboard IC",
  "Accessory",
  "General",
];

export default function SparePartsPage() {
  const [activeTab, setActiveTab] = useState<"catalog" | "batches" | "ledger">("catalog");
  const [parts, setParts] = useState<Part[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [ledger, setLedger] = useState<StockLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modals
  const [showAddPart, setShowAddPart] = useState(false);
  const [showReceiveFifo, setShowReceiveFifo] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);

  // Form: New Part
  const [newSku, setNewSku] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Display");
  const [newQty, setNewQty] = useState("0");
  const [newReorder, setNewReorder] = useState("5");
  const [newUnitCost, setNewUnitCost] = useState("0");
  const [newCompatible, setNewCompatible] = useState("");

  // Form: Receive FIFO
  const [targetPartId, setTargetPartId] = useState("");
  const [receiveQty, setReceiveQty] = useState("10");
  const [receiveCost, setReceiveCost] = useState("1000");

  // Form: Stock Adjustment
  const [adjustPartId, setAdjustPartId] = useState("");
  const [adjustQtyDelta, setAdjustQtyDelta] = useState("-1");
  const [adjustType, setAdjustType] = useState<"adjustment" | "return" | "issue">("adjustment");
  const [adjustReason, setAdjustReason] = useState("Damaged component during inspection");

  // Form: Edit Part
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [editSku, setEditSku] = useState("");
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("Display");
  const [editCompatible, setEditCompatible] = useState("");
  const [editUnitCost, setEditUnitCost] = useState("0");
  const [editReorder, setEditReorder] = useState("5");

  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "catalog") {
        setParts(await getSpareParts(search));
      } else if (activeTab === "batches") {
        setBatches(await getInventoryBatches());
      } else {
        setLedger(await getStockLedger());
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load inventory data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [activeTab, showLowStockOnly]);

  async function handleCreatePart(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createSparePart({
        sku: newSku.trim().toUpperCase(),
        name: newName.trim(),
        category: newCategory,
        quantity: Number(newQty || 0),
        reorder_level: Number(newReorder || 0),
        unit_cost: Number(newUnitCost || 0),
        compatible_models: newCompatible.trim() || undefined,
      });
      setShowAddPart(false);
      setSuccess(`Created spare part ${newSku}.`);
      setNewSku("");
      setNewName("");
      setNewCompatible("");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to add spare part");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReceiveFifo(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await receiveSparePartFifo(targetPartId, Number(receiveQty), Number(receiveCost));
      setShowReceiveFifo(false);
      setSuccess(`Received ${receiveQty} units into FIFO batch. Stock updated to ${res.new_stock_quantity}.`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "FIFO Receiving failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdjustment(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await recordStockAdjustment(adjustPartId, Number(adjustQtyDelta), adjustType, adjustReason);
      setShowAdjust(false);
      setSuccess("Stock adjustment recorded in stock ledger.");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Stock adjustment failed");
    } finally {
      setSubmitting(false);
    }
  }

  function startEditPart(part: Part) {
    setEditingPart(part);
    setEditSku(part.sku);
    setEditName(part.name || part.part_name || "");
    setEditCategory(part.category || "General");
    setEditCompatible(part.compatible_models || "");
    setEditUnitCost(String(part.unit_cost ?? part.purchase_price ?? 0));
    setEditReorder(String(part.reorder_level ?? 5));
  }

  async function handleUpdatePart(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPart) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateSparePart(editingPart.id, {
        sku: editSku.trim().toUpperCase(),
        name: editName.trim(),
        part_name: editName.trim(),
        category: editCategory,
        compatible_models: editCompatible.trim(),
        unit_cost: Number(editUnitCost || 0),
        purchase_price: Number(editUnitCost || 0),
        reorder_level: Number(editReorder || 5),
      });
      setEditingPart(null);
      setSuccess(`Updated spare part SKU ${editSku}.`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to update spare part");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeletePart(id: string, name: string) {
    if (!window.confirm(`Are you sure you want to delete spare part SKU "${name}"?`)) {
      return;
    }
    setError(null);
    try {
      // Optimistic instant UI update
      setParts((prev) => prev.filter((p) => p.id !== id));
      await deleteSparePart(id);
      setSuccess(`Deleted spare part "${name}".`);
      setTimeout(() => setSuccess(null), 4000);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to delete spare part");
      await loadData();
    }
  }

  const displayedParts = showLowStockOnly
    ? parts.filter((p) => p.quantity <= p.reorder_level)
    : parts;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">INVENTORY & VALUATION</div>
          <h1>Spare Parts & FIFO Stock</h1>
          <p>Catalogue management, model compatibility, minimum alerts, FIFO layers, and audit ledger.</p>
        </div>
        <div className="parts-header-actions">
          <button className="primary-btn" onClick={() => setShowAddPart(true)}>
            <Plus size={16} /> Add Part SKU
          </button>
          <div className="parts-sub-actions">
            <button className="secondary-btn" onClick={() => setShowAdjust(true)}>
              <Sliders size={15} /> Stock Adjustment
            </button>
            <button className="secondary-btn" onClick={() => setShowReceiveFifo(true)}>
              <ArrowDownToLine size={15} /> FIFO Stock Receipt
            </button>
          </div>
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
          className={activeTab === "catalog" ? "primary-btn" : "secondary-btn"}
          onClick={() => setActiveTab("catalog")}
        >
          <Wrench size={15} />
          <span className="desktop-tab-label">Spare Parts Master ({parts.length})</span>
          <span className="mobile-tab-label">Parts ({parts.length})</span>
        </button>
        <button
          className={activeTab === "batches" ? "primary-btn" : "secondary-btn"}
          onClick={() => setActiveTab("batches")}
        >
          <Layers size={15} />
          <span className="desktop-tab-label">FIFO Batches</span>
          <span className="mobile-tab-label">Batches</span>
        </button>
        <button
          className={activeTab === "ledger" ? "primary-btn" : "secondary-btn"}
          onClick={() => setActiveTab("ledger")}
        >
          <History size={15} />
          <span className="desktop-tab-label">Stock Movement Ledger</span>
          <span className="mobile-tab-label">Ledger</span>
        </button>
      </div>

      {/* TAB 1: CATALOG */}
      {activeTab === "catalog" && (
        <div className="panel">
          <div className="parts-toolbar-single-row">
            {/* Search Box */}
            <div className="searchbox parts-searchbox">
              <Search size={16} />
              <input
                placeholder="Search part name, SKU, or compatible model..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadData()}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94a3b8",
                    padding: 0,
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Low Stock Button */}
            <button
              type="button"
              className="secondary-btn parts-filter-btn"
              style={{
                background: showLowStockOnly ? "#fff8e7" : "#ffffff",
                color: showLowStockOnly ? "#805b16" : "#475569",
                border: showLowStockOnly ? "1.5px solid #f3dfad" : "1.5px solid #cbd5e1",
              }}
              onClick={() => setShowLowStockOnly(!showLowStockOnly)}
              title={showLowStockOnly ? "Click to view all parts" : "Filter parts running low on stock"}
            >
              <AlertTriangle size={14} style={{ color: showLowStockOnly ? "#d97706" : "#f59e0b" }} />
              <span>{showLowStockOnly ? "Showing Low Stock" : "Filter Low Stock"}</span>
            </button>

            {/* Refresh Action Button */}
            <button className="icon-btn parts-refresh-btn" onClick={loadData} title="Refresh">
              <RefreshCw size={15} />
            </button>

            {/* Parts Count Badge */}
            <span className="count parts-count-badge">
              ⚙️ {displayedParts.length} parts
            </span>
          </div>

          {/* 1. Desktop View Table */}
          <div className="table-wrap desktop-parts-table">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Part Name</th>
                  <th>Category</th>
                  <th>Compatible Models</th>
                  <th>Available Stock</th>
                  <th>Reorder Level</th>
                  <th>Latest Unit Cost</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="empty">Loading parts catalog…</td>
                  </tr>
                ) : displayedParts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="empty">No spare parts match your query.</td>
                  </tr>
                ) : (
                  displayedParts.map((p) => {
                    const isLow = p.quantity <= p.reorder_level;
                    return (
                      <tr key={p.id}>
                        <td>
                          <b><code>{p.sku}</code></b>
                        </td>
                        <td><b>{p.name}</b></td>
                        <td><span className="tag">{p.category}</span></td>
                        <td>{p.compatible_models || "Universal / Not specified"}</td>
                        <td>
                          <b style={{ color: isLow ? "#b42318" : "#15945b", fontSize: "14px" }}>
                            {p.quantity} units
                          </b>
                        </td>
                        <td>{p.reorder_level} units</td>
                        <td>₹{Number(p.unit_cost || p.purchase_price || 0).toLocaleString("en-IN")}</td>
                        <td>
                          {isLow ? (
                            <span className="tag" style={{ background: "#fff0ef", color: "#b42318", fontWeight: 700 }}>
                              <AlertTriangle size={11} style={{ display: "inline", marginRight: 3 }} />
                              Low Stock
                            </span>
                          ) : (
                            <span className="tag" style={{ background: "#e8f8f0", color: "#15945b" }}>
                              In Stock
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <button
                              className="secondary-btn"
                              style={{ padding: "4px 8px", fontSize: "11px" }}
                              onClick={() => {
                                setAdjustPartId(p.id);
                                setShowAdjust(true);
                              }}
                              title="Stock Adjustment"
                            >
                              Adjust
                            </button>
                            <button
                              className="secondary-btn"
                              style={{ padding: "4px 8px", fontSize: "11px" }}
                              onClick={() => startEditPart(p)}
                              title="Edit Part"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              className="secondary-btn"
                              style={{ padding: "4px 8px", fontSize: "11px", color: "#b42318", borderColor: "#fecaca" }}
                              onClick={() => handleDeletePart(p.id, p.name)}
                              title="Delete Part"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 2. Mobile View: Responsive Part Cards */}
          <div className="mobile-parts-cards">
            {loading ? (
              <div style={{ textAlign: "center", padding: "30px 10px", color: "#64748b", fontSize: "13px" }}>
                Loading parts catalog…
              </div>
            ) : displayedParts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 10px", color: "#64748b", fontSize: "13px", background: "#f8fafc", borderRadius: "8px" }}>
                No spare parts match your query.
              </div>
            ) : (
              displayedParts.map((p) => {
                const isLow = p.quantity <= p.reorder_level;
                return (
                  <div key={p.id} className="mobile-part-card">
                    {/* Header */}
                    <div className="mobile-part-header">
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                          <code>{p.sku}</code>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                        <span className="tag" style={{ fontSize: "10.5px" }}>{p.category}</span>
                        {isLow ? (
                          <span className="tag" style={{ background: "#fff0ef", color: "#b42318", fontWeight: 700, fontSize: "10.5px" }}>
                            <AlertTriangle size={11} style={{ display: "inline", marginRight: 2 }} />
                            Low Stock
                          </span>
                        ) : (
                          <span className="tag" style={{ background: "#e8f8f0", color: "#15945b", fontSize: "10.5px" }}>
                            In Stock
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metrics 3-column Grid */}
                    <div className="mobile-part-metrics">
                      <div className="mobile-part-metric-item">
                        <span style={{ fontSize: "10px", color: "#64748b" }}>Available</span>
                        <b style={{ color: isLow ? "#b42318" : "#15945b", fontSize: "13.5px" }}>
                          {p.quantity} units
                        </b>
                      </div>
                      <div className="mobile-part-metric-item">
                        <span style={{ fontSize: "10px", color: "#64748b" }}>Reorder Level</span>
                        <b style={{ fontSize: "12.5px", color: "#334155" }}>{p.reorder_level} units</b>
                      </div>
                      <div className="mobile-part-metric-item">
                        <span style={{ fontSize: "10px", color: "#64748b" }}>Latest Cost</span>
                        <b style={{ fontSize: "12.5px", color: "#0176d3" }}>
                          ₹{Number(p.unit_cost || p.purchase_price || 0).toLocaleString("en-IN")}
                        </b>
                      </div>
                    </div>

                    {/* Compatibility */}
                    <div className="mobile-part-compat">
                      <span style={{ fontWeight: 600, color: "#64748b" }}>Fits:</span>
                      <span>{p.compatible_models || "Universal / Not specified"}</span>
                    </div>

                    {/* Actions */}
                    <div className="mobile-part-actions">
                      <button
                        className="secondary-btn"
                        style={{ padding: "5px 10px", fontSize: "11px", flex: 1, justifyContent: "center" }}
                        onClick={() => {
                          setAdjustPartId(p.id);
                          setShowAdjust(true);
                        }}
                        title="Stock Adjustment"
                      >
                        Adjust
                      </button>
                      <button
                        className="secondary-btn"
                        style={{ padding: "5px 10px", fontSize: "11px", flex: 1, justifyContent: "center" }}
                        onClick={() => startEditPart(p)}
                        title="Edit Part"
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                      <button
                        className="secondary-btn"
                        style={{ padding: "5px 8px", fontSize: "11px", color: "#b42318", borderColor: "#fecaca", justifyContent: "center" }}
                        onClick={() => handleDeletePart(p.id, p.name)}
                        title="Delete Part"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FIFO BATCHES */}
      {activeTab === "batches" && (
        <div className="panel">
          <div className="panel-toolbar">
            <button className="icon-btn" onClick={loadData} title="Refresh">
              <RefreshCw size={16} />
            </button>
            <span className="count">{batches.length} FIFO batches</span>
          </div>

          {/* Desktop Table */}
          <div className="table-wrap desktop-batches-table">
            <table>
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>Part Name / SKU</th>
                  <th>Received Qty</th>
                  <th>Remaining Qty (FIFO)</th>
                  <th>Batch Unit Cost</th>
                  <th>Valuation Remaining</th>
                  <th>Received At</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="empty">Loading FIFO batches…</td>
                  </tr>
                ) : batches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty">No batches registered yet. Receive stock via FIFO to create batches.</td>
                  </tr>
                ) : (
                  batches.map((b) => (
                    <tr key={b.id}>
                      <td><code>{b.id.slice(0, 13)}...</code></td>
                      <td><b>{b.part_name || "Part"}</b> ({b.sku})</td>
                      <td>{b.received_quantity}</td>
                      <td>
                        <b style={{ color: b.remaining_quantity > 0 ? "#15945b" : "#8291a5" }}>
                          {b.remaining_quantity}
                        </b>
                      </td>
                      <td>₹{b.unit_cost.toLocaleString("en-IN")}</td>
                      <td>₹{(b.remaining_quantity * b.unit_cost).toLocaleString("en-IN")}</td>
                      <td>{new Date(b.received_at).toLocaleString("en-IN")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Batches Cards */}
          <div className="mobile-batches-cards">
            {loading ? (
              <div style={{ textAlign: "center", padding: "30px 10px", color: "#64748b", fontSize: "13px" }}>
                Loading FIFO batches…
              </div>
            ) : batches.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 10px", color: "#64748b", fontSize: "13px", background: "#f8fafc", borderRadius: "8px" }}>
                No batches registered yet.
              </div>
            ) : (
              batches.map((b) => (
                <div key={b.id} className="mobile-batch-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "13.5px", color: "#0f172a" }}>
                        {b.part_name || "Part"}
                      </div>
                      <div style={{ fontSize: "10.5px", color: "#8291a5" }}>SKU: {b.sku}</div>
                    </div>
                    <code style={{ fontSize: "11px", color: "#0176d3" }}>#{b.id.slice(0, 8)}</code>
                  </div>

                  <div className="mobile-part-metrics" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                    <div className="mobile-part-metric-item">
                      <span style={{ fontSize: "10px", color: "#64748b" }}>Received</span>
                      <b style={{ fontSize: "12px", color: "#334155" }}>{b.received_quantity}</b>
                    </div>
                    <div className="mobile-part-metric-item">
                      <span style={{ fontSize: "10px", color: "#64748b" }}>Remaining</span>
                      <b style={{ fontSize: "12px", color: b.remaining_quantity > 0 ? "#15945b" : "#8291a5" }}>
                        {b.remaining_quantity}
                      </b>
                    </div>
                    <div className="mobile-part-metric-item">
                      <span style={{ fontSize: "10px", color: "#64748b" }}>Cost</span>
                      <b style={{ fontSize: "12px", color: "#334155" }}>₹{b.unit_cost.toLocaleString("en-IN")}</b>
                    </div>
                    <div className="mobile-part-metric-item">
                      <span style={{ fontSize: "10px", color: "#64748b" }}>Valuation</span>
                      <b style={{ fontSize: "12px", color: "#0176d3" }}>
                        ₹{(b.remaining_quantity * b.unit_cost).toLocaleString("en-IN")}
                      </b>
                    </div>
                  </div>

                  <div style={{ fontSize: "10.5px", color: "#8291a5" }}>
                    Received: {new Date(b.received_at).toLocaleString("en-IN")}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: STOCK LEDGER */}
      {activeTab === "ledger" && (
        <div className="panel">
          <div className="panel-toolbar">
            <button className="icon-btn" onClick={loadData} title="Refresh">
              <RefreshCw size={16} />
            </button>
            <span className="count">{ledger.length} immutable ledger records</span>
          </div>

          {/* Desktop Table */}
          <div className="table-wrap desktop-ledger-table">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Movement Type</th>
                  <th>Part</th>
                  <th>Qty Delta</th>
                  <th>Unit Cost</th>
                  <th>Reference</th>
                  <th>Ledger Entry ID</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="empty">Loading stock ledger…</td>
                  </tr>
                ) : ledger.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty">No stock movements recorded yet.</td>
                  </tr>
                ) : (
                  ledger.map((l) => (
                    <tr key={l.id}>
                      <td>{new Date(l.created_at).toLocaleString("en-IN")}</td>
                      <td>
                        <span
                          className="tag"
                          style={{
                            background: l.movement_type === "purchase" ? "#e8f8f0" : l.movement_type === "issue" ? "#fff2e5" : "#edf5fc",
                            color: l.movement_type === "purchase" ? "#15945b" : l.movement_type === "issue" ? "#e68a2e" : "#0176d3",
                            textTransform: "uppercase",
                            fontWeight: 700,
                          }}
                        >
                          {l.movement_type}
                        </span>
                      </td>
                      <td><b>{l.part_name || "Part"}</b> ({l.sku})</td>
                      <td>
                        <b style={{ color: l.quantity_delta > 0 ? "#15945b" : "#b42318" }}>
                          {l.quantity_delta > 0 ? `+${l.quantity_delta}` : l.quantity_delta}
                        </b>
                      </td>
                      <td>₹{l.unit_cost.toLocaleString("en-IN")}</td>
                      <td>{l.reference_type || "N/A"}</td>
                      <td><code>{l.id.slice(0, 10)}...</code></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Ledger Cards */}
          <div className="mobile-ledger-cards">
            {loading ? (
              <div style={{ textAlign: "center", padding: "30px 10px", color: "#64748b", fontSize: "13px" }}>
                Loading stock ledger…
              </div>
            ) : ledger.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 10px", color: "#64748b", fontSize: "13px", background: "#f8fafc", borderRadius: "8px" }}>
                No stock movements recorded yet.
              </div>
            ) : (
              ledger.map((l) => (
                <div key={l.id} className="mobile-ledger-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 700, fontSize: "13.5px", color: "#0f172a" }}>
                      {l.part_name || "Part"} <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 400 }}>({l.sku})</span>
                    </div>
                    <span
                      className="tag"
                      style={{
                        background: l.movement_type === "purchase" ? "#e8f8f0" : l.movement_type === "issue" ? "#fff2e5" : "#edf5fc",
                        color: l.movement_type === "purchase" ? "#15945b" : l.movement_type === "issue" ? "#e68a2e" : "#0176d3",
                        textTransform: "uppercase",
                        fontWeight: 700,
                        fontSize: "10px",
                      }}
                    >
                      {l.movement_type}
                    </span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "8px 10px", borderRadius: "6px" }}>
                    <div>
                      <span style={{ fontSize: "10px", color: "#64748b" }}>Qty Delta: </span>
                      <b style={{ color: l.quantity_delta > 0 ? "#15945b" : "#b42318", fontSize: "13px" }}>
                        {l.quantity_delta > 0 ? `+${l.quantity_delta}` : l.quantity_delta}
                      </b>
                    </div>
                    <div>
                      <span style={{ fontSize: "10px", color: "#64748b" }}>Unit Cost: </span>
                      <b style={{ fontSize: "12px", color: "#0176d3" }}>₹{l.unit_cost.toLocaleString("en-IN")}</b>
                    </div>
                    <div>
                      <span style={{ fontSize: "10px", color: "#64748b" }}>Ref: </span>
                      <span style={{ fontSize: "11px", fontWeight: 600 }}>{l.reference_type || "N/A"}</span>
                    </div>
                  </div>

                  <div style={{ fontSize: "10.5px", color: "#8291a5", display: "flex", justifyContent: "space-between" }}>
                    <span>{new Date(l.created_at).toLocaleString("en-IN")}</span>
                    <code>{l.id.slice(0, 10)}...</code>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD PART SKU */}
      {showAddPart && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleCreatePart}>
            <div className="modal-head">
              <div>
                <h2>Create Spare Part SKU</h2>
                <p>Register a replacement component in the workshop catalogue</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowAddPart(false)}>×</button>
            </div>

            <div className="form-grid">
              <label>
                SKU Code *
                <input required placeholder="e.g. DISP-IPH13-OLED" value={newSku} onChange={(e) => setNewSku(e.target.value)} />
              </label>
              <label>
                Part Name *
                <input required placeholder="e.g. iPhone 13 OLED Screen Replacement" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </label>
              <label style={{ display: "grid", gap: "7px" }}>
                Category *
                <CustomSelect
                  value={newCategory}
                  onChange={(val) => setNewCategory(val)}
                  options={CATEGORY_OPTIONS}
                  style={{ width: "100%" }}
                  minWidth="100%"
                  height="38px"
                />
              </label>
              <label>
                Compatible Mobile Models
                <input placeholder="e.g. iPhone 13, iPhone 13 Mini" value={newCompatible} onChange={(e) => setNewCompatible(e.target.value)} />
              </label>
              <label>
                Opening Quantity
                <input type="number" min="0" value={newQty} onChange={(e) => setNewQty(e.target.value)} />
              </label>
              <label>
                Reorder Threshold Level
                <input type="number" min="0" value={newReorder} onChange={(e) => setNewReorder(e.target.value)} />
              </label>
              <label>
                Base Unit Cost (₹)
                <input type="number" min="0" value={newUnitCost} onChange={(e) => setNewUnitCost(e.target.value)} />
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setShowAddPart(false)}>Cancel</button>
              <button className="primary-btn" disabled={submitting}>
                {submitting ? "Saving..." : "Save Part SKU"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: RECEIVE FIFO STOCK */}
      {showReceiveFifo && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleReceiveFifo}>
            <div className="modal-head">
              <div>
                <h2>FIFO Stock Receiving</h2>
                <p>Add new stock batch with historical purchase unit cost</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowReceiveFifo(false)}>×</button>
            </div>

            <div className="form-grid">
              <label style={{ gridColumn: "1 / -1" }}>
                Target Spare Part *
                <select required value={targetPartId} onChange={(e) => setTargetPartId(e.target.value)}>
                  <option value="">-- Select Spare Part SKU --</option>
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — Current Stock: {p.quantity}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Received Quantity *
                <input type="number" min="1" required value={receiveQty} onChange={(e) => setReceiveQty(e.target.value)} />
              </label>
              <label>
                Batch Unit Cost (₹) *
                <input type="number" min="0" required value={receiveCost} onChange={(e) => setReceiveCost(e.target.value)} />
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setShowReceiveFifo(false)}>Cancel</button>
              <button className="primary-btn" disabled={submitting || !targetPartId}>
                {submitting ? "Processing..." : "Create FIFO Batch"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: STOCK ADJUSTMENT */}
      {showAdjust && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleAdjustment}>
            <div className="modal-head">
              <div>
                <h2>Stock Adjustment / Damaged Stock</h2>
                <p>Reconcile inventory, scrap damaged parts, or record returns</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowAdjust(false)}>×</button>
            </div>

            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "6px", padding: "10px 12px", fontSize: "11.5px", color: "#1e40af", marginBottom: "14px", lineHeight: "1.5" }}>
              <b>💡 Customer Phone Repair Job ke liye Note:</b> Agar aap kisi customer phone (Job Card) me spare part laga rahe hain, toh yahan se stock adjust karne ki zaroorat nahi hai. <b>Repair Job Cards</b> page par jakar phone ke aage <b>"+ Part"</b> button par click karein, jisse FIFO cost seedha us phone ki Job Card aur profit calculation me jud jaye.
            </div>

            <div className="form-grid">
              <label style={{ gridColumn: "1 / -1" }}>
                Spare Part *
                <select required value={adjustPartId} onChange={(e) => setAdjustPartId(e.target.value)}>
                  <option value="">-- Select Part to Adjust --</option>
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — Current Stock: {p.quantity}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Adjustment Type *
                <select value={adjustType} onChange={(e: any) => setAdjustType(e.target.value)}>
                  <option value="adjustment">Physical Audit Adjustment</option>
                  <option value="issue">Damaged / Scrapped Component</option>
                  <option value="return">Returned to Supplier</option>
                </select>
              </label>
              <label>
                Quantity Delta * (e.g. -2 for damage, +3 for recount)
                <input type="number" required value={adjustQtyDelta} onChange={(e) => setAdjustQtyDelta(e.target.value)} />
              </label>
            </div>

            <div style={{ marginTop: "12px" }}>
              <label style={{ fontSize: "10px", color: "#687b92", display: "grid", gap: "6px" }}>
                Reason / Audit Note *
                <input required placeholder="e.g. Screen cracked during transit, inventory recount discrepancy" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} style={{ border: "1px solid #e0e7ef", borderRadius: "6px", height: "36px", padding: "0 10px", fontSize: "12px" }} />
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setShowAdjust(false)}>Cancel</button>
              <button className="primary-btn" disabled={submitting || !adjustPartId}>
                {submitting ? "Saving..." : "Record Adjustment"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: EDIT PART */}
      {editingPart && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleUpdatePart}>
            <div className="modal-head">
              <div>
                <h2>Edit Spare Part SKU</h2>
                <p>Modify part title, SKU code or compatible smartphone models</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setEditingPart(null)}>×</button>
            </div>

            <div className="form-grid">
              <label>
                SKU / Part Code *
                <input required value={editSku} onChange={(e) => setEditSku(e.target.value)} />
              </label>
              <label>
                Part Name *
                <input required value={editName} onChange={(e) => setEditName(e.target.value)} />
              </label>
              <label style={{ display: "grid", gap: "7px" }}>
                Category *
                <CustomSelect
                  value={editCategory}
                  onChange={(val) => setEditCategory(val)}
                  options={CATEGORY_OPTIONS}
                  style={{ width: "100%" }}
                  minWidth="100%"
                  height="38px"
                />
              </label>
              <label>
                Latest Unit Cost (₹)
                <input type="number" min="0" value={editUnitCost} onChange={(e) => setEditUnitCost(e.target.value)} />
              </label>
              <label>
                Reorder Threshold Level
                <input type="number" min="0" value={editReorder} onChange={(e) => setEditReorder(e.target.value)} />
              </label>
            </div>

            <div style={{ marginTop: "12px" }}>
              <label style={{ fontSize: "10px", color: "#687b92", display: "grid", gap: "6px" }}>
                Compatible Phone Models
                <input
                  placeholder="e.g. iPhone 13, iPhone 13 Pro, iPhone 14"
                  value={editCompatible}
                  onChange={(e) => setEditCompatible(e.target.value)}
                  style={{ border: "1px solid #e0e7ef", borderRadius: "6px", height: "36px", padding: "0 10px", fontSize: "12px" }}
                />
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setEditingPart(null)}>Cancel</button>
              <button className="primary-btn" disabled={submitting}>
                {submitting ? "Saving..." : "Update Part"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
