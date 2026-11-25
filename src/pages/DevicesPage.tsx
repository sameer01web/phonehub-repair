import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Smartphone,
  Plus,
  Search,
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Layers,
  History,
  IndianRupee,
  Calendar,
  X,
  Edit2,
  Trash2,
  Upload,
  Table as TableIcon,
  Copy,
  ExternalLink,
  Camera,
  ShieldCheck,
  Check,
} from "lucide-react";
import CameraImeiScanner from "../components/CameraImeiScanner";
import CustomSelect from "../components/CustomSelect";
import {
  getDevices,
  createDevice,
  updateDevice,
  deleteDevice,
  bulkImportDevices,
  getDeviceTimeline,
  getDeviceCostSummary,
  getShipments,
  normalizeDeviceStatus,
  formatDeviceStatus,
} from "../lib/repairs";
import type { Device, DeviceTimelineEvent, DeviceCostSummary, Shipment, DeviceCondition } from "../lib/types";

interface DynamicRow {
  id: string;
  brand: string;
  model: string;
  imei: string;
  color: string;
  storage: string;
  condition?: DeviceCondition;
  cost?: string;
  issue: string;
}

export default function DevicesPage() {
  const [searchParams] = useSearchParams();
  const [devices, setDevices] = useState<Device[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [storageFilter, setStorageFilter] = useState<string>("all");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const s = searchParams.get("status");
    if (s) setStatusFilter(s);
  }, [searchParams]);

  // Modals
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);
  const [bulkMode, setBulkMode] = useState<"rows" | "csv">("rows");
  const [active360Device, setActive360Device] = useState<Device | null>(null);
  const [timeline, setTimeline] = useState<DeviceTimelineEvent[]>([]);
  const [costSummary, setCostSummary] = useState<DeviceCostSummary | null>(null);
  const [loading360, setLoading360] = useState<boolean>(false);

  // Single Add Device Form State
  const [formBrand, setFormBrand] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formImei, setFormImei] = useState("");
  const [formColor, setFormColor] = useState("Black");
  const [formStorage, setFormStorage] = useState("128GB");
  const [formCondition, setFormCondition] = useState<DeviceCondition>("Good");
  const [formPurchaseCost, setFormPurchaseCost] = useState("0");
  const [formReceivedDate, setFormReceivedDate] = useState(new Date().toISOString().split("T")[0]);
  const [formInitialIssue, setFormInitialIssue] = useState("");
  const [formShipmentId, setFormShipmentId] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Camera IMEI Scanner State
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerTargetRowId, setScannerTargetRowId] = useState<string | null>(null);

  function handleScannedImei(imei: string) {
    if (scannerTargetRowId === "EDIT_DEVICE") {
      setEditImei(imei);
    } else if (scannerTargetRowId) {
      updateDynamicRow(scannerTargetRowId, "imei", imei);
    } else {
      setFormImei(imei);
    }
    setScannerOpen(false);
    setScannerTargetRowId(null);
  }

  // Dynamic Multiple Rows State for Bulk Entry
  const [dynamicRows, setDynamicRows] = useState<DynamicRow[]>([
    { id: "1", brand: "Apple", model: "iPhone 13", imei: "", color: "Midnight", storage: "128GB", condition: "Good", cost: "0", issue: "Battery health low" },
    { id: "2", brand: "Samsung", model: "Galaxy S22", imei: "", color: "Phantom Black", storage: "256GB", condition: "Good", cost: "0", issue: "Minor scratches" },
  ]);

  // Bulk CSV Import State
  const [bulkCsvText, setBulkCsvText] = useState("");
  const [bulkShipmentId, setBulkShipmentId] = useState("");
  const [bulkResult, setBulkResult] = useState<{ successCount: number; errors: string[] } | null>(null);

  // Edit Device Form State
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [editBrand, setEditBrand] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editImei, setEditImei] = useState("");
  const [editColor, setEditColor] = useState("Black");
  const [editStorage, setEditStorage] = useState("128GB");
  const [editCondition, setEditCondition] = useState<DeviceCondition>("Good");
  const [editStatus, setEditStatus] = useState("received");
  const [editPurchaseCost, setEditPurchaseCost] = useState("0");
  const [editNotes, setEditNotes] = useState("");
  const [editIssue, setEditIssue] = useState("");

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [devList, shipList] = await Promise.all([
        getDevices(search, statusFilter),
        getShipments(),
      ]);
      setDevices(devList);
      setShipments(shipList);
    } catch (err: any) {
      setError(err?.message || "Failed to load devices");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  // Filtered devices across storage, condition, search
  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      // Storage filter
      if (storageFilter !== "all" && d.storage_capacity !== storageFilter) return false;
      // Condition filter
      if (conditionFilter !== "all" && d.condition !== conditionFilter) return false;
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesBrand = d.brand?.toLowerCase().includes(q);
        const matchesModel = d.model?.toLowerCase().includes(q);
        const matchesImei = (d.imei1 || d.imei || "").toLowerCase().includes(q);
        const matchesColor = (d.color || "").toLowerCase().includes(q);
        const matchesStorage = (d.storage_capacity || "").toLowerCase().includes(q);
        const matchesNotes = (d.notes || "").toLowerCase().includes(q);
        const matchesIssue = (d.initial_issue || "").toLowerCase().includes(q);
        return matchesBrand || matchesModel || matchesImei || matchesColor || matchesStorage || matchesNotes || matchesIssue;
      }
      return true;
    });
  }, [devices, storageFilter, conditionFilter, search]);

  // Real-time stock counts
  const totalStock = devices.length;
  const receivedStock = devices.filter((d) => normalizeDeviceStatus(d.status) === "received").length;
  const inRepairStock = devices.filter((d) => normalizeDeviceStatus(d.status) === "in_repair" || normalizeDeviceStatus(d.status) === "repair").length;
  const readyStock = devices.filter((d) => normalizeDeviceStatus(d.status) === "ready_for_sale").length;
  const totalValuation = devices.reduce((sum, d) => sum + Number(d.purchase_cost || 0), 0);

  // Single Add Device Submit
  async function handleAddSingleDevice(e: React.FormEvent) {
    e.preventDefault();
    if (!formBrand.trim() || !formModel.trim()) {
      setError("Please provide both phone brand and model.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createDevice({
        brand: formBrand.trim(),
        model: formModel.trim(),
        imei1: formImei.trim() || null,
        serial_number: null,
        color: formColor.trim() || "Black",
        storage_capacity: formStorage.trim() || "128GB",
        condition: formCondition,
        status: "received",
        purchase_cost: Number(formPurchaseCost || 0),
        received_date: formReceivedDate || new Date().toISOString(),
        initial_issue: formInitialIssue.trim() || null,
        shipment_id: formShipmentId || null,
        notes: formNotes.trim() || null,
      });
      setShowAddModal(false);
      resetSingleForm();
      setSuccessMsg(`Handset "${formBrand} ${formModel}" registered successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to register handset");
    } finally {
      setSubmitting(false);
    }
  }

  function resetSingleForm() {
    setFormBrand("");
    setFormModel("");
    setFormImei("");
    setFormColor("Black");
    setFormStorage("128GB");
    setFormCondition("Good");
    setFormPurchaseCost("0");
    setFormReceivedDate(new Date().toISOString().split("T")[0]);
    setFormInitialIssue("");
    setFormShipmentId("");
    setFormNotes("");
  }

  // Dynamic Row Actions
  function addDynamicRow() {
    setDynamicRows([
      ...dynamicRows,
      {
        id: String(Date.now()),
        brand: "",
        model: "",
        imei: "",
        color: "Black",
        storage: "128GB",
        condition: "Good",
        cost: "0",
        issue: "",
      },
    ]);
  }

  function removeDynamicRow(id: string) {
    if (dynamicRows.length <= 1) return;
    setDynamicRows(dynamicRows.filter((r) => r.id !== id));
  }

  function updateDynamicRow(id: string, field: keyof DynamicRow, value: any) {
    setDynamicRows(dynamicRows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  // Submit Dynamic Multiple Rows
  async function handleSubmitDynamicRows(e: React.FormEvent) {
    e.preventDefault();
    const validRows = dynamicRows.filter((r) => r.brand.trim() && r.model.trim());
    if (validRows.length === 0) {
      setError("Please fill in Brand and Model for at least one handset.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = validRows.map((r) => ({
        brand: r.brand.trim(),
        model: r.model.trim(),
        imei: r.imei.trim() || undefined,
        color: r.color.trim() || "Black",
        storage_capacity: r.storage.trim() || "128GB",
        condition: r.condition || "Good",
        purchase_cost: Number(r.cost || 0),
        initial_issue: r.issue.trim() || undefined,
        shipment_id: bulkShipmentId || undefined,
      }));

      const res = await bulkImportDevices(payload);
      setBulkResult(res);
      if (res.successCount > 0) {
        setSuccessMsg(`Successfully imported ${res.successCount} handset(s) into inventory.`);
        setTimeout(() => setSuccessMsg(null), 4000);
        await loadData();
      }
    } catch (err: any) {
      setError(err?.message || "Bulk row entry failed");
    } finally {
      setSubmitting(false);
    }
  }

  // Submit CSV/Excel Text Import
  async function handleBulkCsvImport(e: React.FormEvent) {
    e.preventDefault();
    if (!bulkCsvText.trim()) return;
    setSubmitting(true);
    setBulkResult(null);
    setError(null);
    try {
      const lines = bulkCsvText.trim().split("\n");
      const rows = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.toLowerCase().startsWith("brand,")) continue;
        const parts = line.split(",").map((s) => s?.trim());
        let brand = "", model = "", imei = "", color = "Black", storage = "128GB", condition: any = "Good", cost = "0", issue = "";
        if (parts.length >= 8) {
          [brand, model, imei, color, storage, condition, cost, issue] = parts;
        } else if (parts.length >= 6) {
          [brand, model, imei, color, storage, issue] = parts;
        } else {
          [brand, model, imei, color, storage] = parts;
        }

        if (brand && model) {
          rows.push({
            brand,
            model,
            imei: imei || undefined,
            color: color || "Black",
            storage_capacity: storage || "128GB",
            condition: condition || "Good",
            purchase_cost: Number(cost || 0),
            initial_issue: issue || undefined,
            shipment_id: bulkShipmentId || undefined,
          });
        }
      }
      if (rows.length === 0) {
        throw new Error("No valid rows detected. Ensure format: Brand, Model, IMEI, Color, Storage, Issue");
      }
      const res = await bulkImportDevices(rows);
      setBulkResult(res);
      if (res.successCount > 0) {
        setSuccessMsg(`Imported ${res.successCount} handsets from CSV.`);
        setTimeout(() => setSuccessMsg(null), 4000);
        await loadData();
      }
    } catch (err: any) {
      setError(err?.message || "CSV import failed");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCsvFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) setBulkCsvText(text);
    };
    reader.readAsText(file);
  }

  function loadSampleCsv() {
    const sample = `Brand, Model, IMEI, Color, Storage, Issue
Apple, iPhone 14 Pro, 356890098765431, Space Black, 256GB, Broken front glass
Samsung, Galaxy S23, 356890098765432, Cream, 128GB, Screen minor scratches
Google, Pixel 8, 356890098765433, Obsidian, 128GB, Battery health 85%
Xiaomi, Redmi Note 13, 356890098765434, Blue, 128GB, Speaker muffled`;
    setBulkCsvText(sample);
  }

  // Device 360 Lifecycle View
  async function openDevice360(dev: Device) {
    setActive360Device(dev);
    setLoading360(true);
    try {
      const [tl, cs] = await Promise.all([
        getDeviceTimeline(dev.id),
        getDeviceCostSummary(dev.id),
      ]);
      setTimeline(tl);
      setCostSummary(cs);
    } catch (err) {
      console.warn("Could not load 360 data:", err);
    } finally {
      setLoading360(false);
    }
  }

  // Edit Device
  function startEditDevice(dev: Device) {
    setEditingDevice(dev);
    setEditBrand(dev.brand || "");
    setEditModel(dev.model || "");
    setEditImei(dev.imei || dev.imei1 || "");
    setEditColor(dev.color || "Black");
    setEditStorage(dev.storage_capacity || "128GB");
    setEditCondition((dev.condition as DeviceCondition) || "Good");
    setEditStatus(normalizeDeviceStatus(dev.status));
    setEditPurchaseCost(String(dev.purchase_cost || 0));
    setEditIssue(dev.initial_issue || "");
    const cleanNotes = (dev.notes || "").replace(/\[.*?\]\s*/, "").trim();
    setEditNotes(cleanNotes);
  }

  async function handleUpdateDevice(e: React.FormEvent) {
    e.preventDefault();
    if (!editingDevice) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateDevice(editingDevice.id, {
        brand: editBrand.trim(),
        model: editModel.trim(),
        imei: editImei.trim() || undefined,
        color: editColor.trim(),
        storage_capacity: editStorage.trim(),
        initial_issue: editIssue.trim() || undefined,
        status: editStatus,
        purchase_cost: Number(editPurchaseCost || 0),
        notes: editNotes.trim(),
      });
      setEditingDevice(null);
      setSuccessMsg(`Handset "${editBrand} ${editModel}" updated successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to update device");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteDevice(id: string, name: string) {
    if (!window.confirm(`Are you sure you want to delete handset "${name}"? This action cannot be undone.`)) {
      return;
    }
    setError(null);
    try {
      await deleteDevice(id);
      setSuccessMsg(`Handset "${name}" deleted from inventory.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to delete device");
    }
  }

  const statuses = [
    { value: "all", label: "All Statuses" },
    { value: "received", label: "Received (Intake)" },
    { value: "in_repair", label: "In Repair" },
    { value: "ready_for_sale", label: "Ready for Handover" },
    { value: "scrapped", label: "Scrapped" },
    { value: "sold", label: "Delivered / Handed Over" },
  ];

  const storageOptions = ["all", "32GB", "64GB", "128GB", "256GB", "512GB", "1TB"];
  const conditionOptions = ["all", "Brand New", "Like New", "Excellent", "Good", "Fair", "Damaged", "Scrap"];

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">HANDSET INVENTORY & INTAKE</div>
          <h1>Phone Inventory & Bulk Handset Intake</h1>
          <p>
            Track individual handsets by unique IMEI, storage, intake cost, and 360° repair lifecycle.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="secondary-btn" onClick={() => setShowBulkModal(true)}>
            <TableIcon size={16} /> Bulk Phone Entry / CSV
          </button>
          <button className="primary-btn" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Add Single Phone
          </button>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}
      {successMsg && <div className="notice success">{successMsg}</div>}

      {/* Stock Summary Metrics Bar */}
      <div className="stats-grid" style={{ marginBottom: "16px" }}>
        <div className="stat-card">
          <div className="stat-icon Blue"><Smartphone size={20} /></div>
          <div>
            <div className="stat-label">Total Phones in Stock</div>
            <div className="stat-val">{totalStock}</div>
            <div className="stat-meta">Distinct handsets tracked</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon Orange"><Calendar size={20} /></div>
          <div>
            <div className="stat-label">Intake Pending / Received</div>
            <div className="stat-val">{receivedStock}</div>
            <div className="stat-meta">Awaiting repair diagnosis</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon Orange"><Layers size={20} /></div>
          <div>
            <div className="stat-label">In Active Repair</div>
            <div className="stat-val">{inRepairStock}</div>
            <div className="stat-meta">On technician bench</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon Green"><CheckCircle2 size={20} /></div>
          <div>
            <div className="stat-label">Ready for Handover</div>
            <div className="stat-val">{readyStock}</div>
            <div className="stat-meta">Repairs tested & approved</div>
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="panel" style={{ paddingBottom: "24px" }}>
        <div className="devices-toolbar-container">
          {/* Row 1: Search & Dropdown Filters */}
          <div className="devices-search-and-actions">
            <div className="searchbox" style={{ flex: 1, minWidth: "220px", position: "relative" }}>
              <Search size={16} />
              <input
                placeholder="Search brand, model, IMEI, notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadData()}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94a3b8",
                    padding: 0,
                  }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Custom Select Filters Grid */}
            <div className="devices-filters-grid">
              <CustomSelect
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={statuses}
                minWidth="160px"
              />

              <CustomSelect
                label="Storage"
                value={storageFilter}
                onChange={setStorageFilter}
                options={storageOptions.map((st) => ({
                  value: st,
                  label: st === "all" ? "All Storage" : st,
                }))}
                minWidth="135px"
              />
            </div>
          </div>

          {/* Row 2: Metadata & Fast Actions */}
          <div className="devices-meta-bar">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <button
                className="icon-btn"
                onClick={loadData}
                title="Refresh list"
                style={{ height: "34px", width: "34px", borderRadius: "8px" }}
              >
                <RefreshCw size={14} />
              </button>

              {(statusFilter !== "all" || storageFilter !== "all" || search.trim() !== "") && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setStatusFilter("all");
                    setStorageFilter("all");
                    setConditionFilter("all");
                    setSearch("");
                  }}
                  style={{ height: "32px", fontSize: "11px", padding: "0 10px", color: "#e68a2e", borderRadius: "8px" }}
                >
                  <X size={12} /> Reset Filters
                </button>
              )}
            </div>

            <span
              className="count"
              style={{
                fontSize: "12px",
                color: "#0176d3",
                fontWeight: 600,
                background: "#edf5fc",
                padding: "4px 10px",
                borderRadius: "20px",
              }}
            >
              📱 {filteredDevices.length} phone{filteredDevices.length === 1 ? "" : "s"} found
            </span>
          </div>
        </div>

        {/* 1. Desktop View: Comprehensive 8-column Table */}
        <div className="table-wrap desktop-devices-table">
          <table>
            <thead>
              <tr>
                <th>Phone Model</th>
                <th>IMEI Number</th>
                <th>Storage</th>
                <th>Color</th>
                <th>Initial Problem / Notes</th>
                <th>Status</th>
                <th>Received Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="empty">Loading phone inventory…</td>
                </tr>
              ) : filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty">
                    No handsets match your filters. Click "Add Single Phone" or "Bulk Phone Entry" to register handsets.
                  </td>
                </tr>
              ) : (
                filteredDevices.map((d) => {
                  const norm = normalizeDeviceStatus(d.status);
                  const isReady = norm === "ready_for_sale" || norm === "sold";
                  const isRepair = norm === "in_repair" || norm === "repair";
                  const isScrapped = norm === "scrapped";

                  return (
                    <tr key={d.id}>
                      <td>
                        <b>{d.brand} {d.model}</b>
                        {d.serial_number && (
                          <div style={{ fontSize: "10px", color: "#64748b" }}>S/N: {d.serial_number}</div>
                        )}
                      </td>
                      <td>
                        {d.imei1 ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <code>{d.imei1}</code>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(d.imei1 || "");
                                setSuccessMsg(`Copied IMEI ${d.imei1}`);
                                setTimeout(() => setSuccessMsg(null), 2500);
                              }}
                              title="Copy IMEI"
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: "2px" }}
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8", fontStyle: "italic" }}>None / Unlisted</span>
                        )}
                      </td>
                      <td>
                        <span className="tag" style={{ background: "#f1f5f9", color: "#334155", fontWeight: 700 }}>
                          {d.storage_capacity || "128GB"}
                        </span>
                      </td>
                      <td>{d.color || "Black"}</td>
                      <td>
                        {d.initial_issue ? (
                          <div style={{ fontSize: "11px", color: "#0f172a", fontWeight: 500 }}>
                            {d.initial_issue}
                          </div>
                        ) : (
                          <div style={{ fontSize: "11px", color: "#64748b" }}>
                            {d.notes || "—"}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          className="tag"
                          style={{
                            background: isReady ? "#e8f8f0" : isRepair ? "#fff2e5" : isScrapped ? "#fef3f2" : "#edf5fc",
                            color: isReady ? "#15945b" : isRepair ? "#e68a2e" : isScrapped ? "#b42318" : "#0176d3",
                            fontWeight: 700,
                          }}
                        >
                          {formatDeviceStatus(d.status)}
                        </span>
                      </td>
                      <td>
                        {d.created_at ? new Date(d.created_at).toLocaleDateString("en-IN") : "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <button
                            className="secondary-btn"
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            onClick={() => openDevice360(d)}
                            title="Inspect 360° History & Financials"
                          >
                            <History size={13} /> 360°
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => startEditDevice(d)}
                            title="Edit Handset"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => handleDeleteDevice(d.id, `${d.brand} ${d.model}`)}
                            title="Delete Handset"
                            style={{ color: "#b42318" }}
                          >
                            <Trash2 size={13} />
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

        {/* 2. Mobile View: Touch-Friendly Responsive Handset Cards */}
        <div className="mobile-devices-cards">
          {loading ? (
            <div style={{ textAlign: "center", padding: "30px 10px", color: "#64748b", fontSize: "13px" }}>
              Loading phone inventory…
            </div>
          ) : filteredDevices.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 10px", color: "#64748b", fontSize: "13px", background: "#f8fafc", borderRadius: "8px" }}>
              No handsets match your filters.
            </div>
          ) : (
            filteredDevices.map((d) => {
              const norm = normalizeDeviceStatus(d.status);
              const isReady = norm === "ready_for_sale" || norm === "sold";
              const isRepair = norm === "in_repair" || norm === "repair";
              const isScrapped = norm === "scrapped";

              return (
                <div key={d.id} className="mobile-device-card">
                  {/* Card Header: Brand Model & Status */}
                  <div className="mobile-device-header">
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
                        {d.brand} {d.model}
                      </div>
                      {d.serial_number && (
                        <div style={{ fontSize: "10px", color: "#8291a5" }}>S/N: {d.serial_number}</div>
                      )}
                    </div>
                    <span
                      className="tag"
                      style={{
                        background: isReady ? "#e8f8f0" : isRepair ? "#fff2e5" : isScrapped ? "#fef3f2" : "#edf5fc",
                        color: isReady ? "#15945b" : isRepair ? "#e68a2e" : isScrapped ? "#b42318" : "#0176d3",
                        fontWeight: 700,
                        fontSize: "11px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDeviceStatus(d.status)}
                    </span>
                  </div>

                  {/* Specs Pill Badges */}
                  <div className="mobile-device-specs">
                    {d.imei1 ? (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          background: "#f1f5f9",
                          borderRadius: "6px",
                          padding: "2px 8px",
                          fontSize: "11px",
                        }}
                      >
                        <span style={{ color: "#64748b", fontSize: "10px" }}>IMEI:</span>
                        <code style={{ fontWeight: 600, color: "#1e293b" }}>{d.imei1}</code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(d.imei1 || "");
                            setSuccessMsg(`Copied IMEI ${d.imei1}`);
                            setTimeout(() => setSuccessMsg(null), 2500);
                          }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#0176d3", padding: "1px 2px" }}
                          title="Copy IMEI"
                        >
                          <Copy size={11} />
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>No IMEI</span>
                    )}

                    <span className="tag" style={{ background: "#edf5fc", color: "#0176d3", fontWeight: 700, fontSize: "11px" }}>
                      {d.storage_capacity || "128GB"}
                    </span>
                    <span className="tag" style={{ background: "#f8fafc", color: "#475569", fontSize: "11px" }}>
                      {d.color || "Black"}
                    </span>
                  </div>

                  {/* Issue / Notes Row */}
                  {(d.initial_issue || d.notes) && (
                    <div className="mobile-device-issue">
                      <span><strong>Issue:</strong> {d.initial_issue || d.notes}</span>
                    </div>
                  )}

                  {/* Footer Row: Received Date & Actions */}
                  <div className="mobile-device-footer">
                    <div>
                      <div style={{ fontSize: "10px", color: "#8291a5" }}>Received Date</div>
                      <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "12px" }}>
                        {d.created_at ? new Date(d.created_at).toLocaleDateString("en-IN") : "—"}
                      </div>
                    </div>

                    <div className="mobile-device-actions">
                      <button
                        className="secondary-btn"
                        style={{ padding: "5px 10px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        onClick={() => openDevice360(d)}
                        title="Inspect 360° History & Financials"
                      >
                        <History size={12} /> 360°
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => startEditDevice(d)}
                        title="Edit Handset"
                        style={{ height: "30px", width: "30px" }}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => handleDeleteDevice(d.id, `${d.brand} ${d.model}`)}
                        title="Delete Handset"
                        style={{ color: "#b42318", height: "30px", width: "30px" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL: ADD SINGLE PHONE */}
      {showAddModal && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleAddSingleDevice} style={{ maxWidth: "620px" }}>
            <div className="modal-head">
              <div>
                <h2>Add Single Phone Record</h2>
                <p>Register an incoming phone into inventory with individual IMEI and specs.</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowAddModal(false)}>×</button>
            </div>

            <div className="form-grid">
              <label>
                Brand *
                <input
                  required
                  placeholder="e.g. Apple, Samsung, Xiaomi"
                  value={formBrand}
                  onChange={(e) => setFormBrand(e.target.value)}
                />
              </label>

              <label>
                Model *
                <input
                  required
                  placeholder="e.g. iPhone 15 Pro, Galaxy S23"
                  value={formModel}
                  onChange={(e) => setFormModel(e.target.value)}
                />
              </label>

              <label>
                IMEI Number (14-16 digits, optional)
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input
                    placeholder="e.g. 354890098765432"
                    value={formImei}
                    onChange={(e) => setFormImei(e.target.value)}
                    style={{ width: "100%", paddingRight: "44px" }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setScannerTargetRowId(null);
                      setScannerOpen(true);
                    }}
                    title="Scan IMEI Barcode with Camera"
                    style={{
                      position: "absolute",
                      right: "5px",
                      background: "#f0f7ff",
                      border: "1px solid #bae6fd",
                      borderRadius: "6px",
                      color: "#0284c7",
                      padding: "4px 8px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    <Camera size={15} />
                  </button>
                </div>
              </label>

              <label>
                Color
                <input
                  placeholder="e.g. Titanium Black, Blue, Silver"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                />
              </label>

              <label style={{ display: "grid", gap: "7px" }}>
                Storage Capacity
                <CustomSelect
                  value={formStorage}
                  onChange={(val) => setFormStorage(val)}
                  options={["32GB", "64GB", "128GB", "256GB", "512GB", "1TB"]}
                  style={{ width: "100%" }}
                  minWidth="100%"
                  height="38px"
                />
              </label>

              <label>
                Received / Purchase Date
                <input
                  type="date"
                  value={formReceivedDate}
                  onChange={(e) => setFormReceivedDate(e.target.value)}
                />
              </label>
            </div>

            <div style={{ marginTop: "12px", display: "grid", gap: "10px" }}>
              <label style={{ fontSize: "11px", color: "#687b92", display: "grid", gap: "4px" }}>
                Initial Issue / Reported Problem
                <input
                  placeholder="e.g. Screen cracked, battery draining fast, audio muffled"
                  value={formInitialIssue}
                  onChange={(e) => setFormInitialIssue(e.target.value)}
                  style={{ border: "1px solid #e0e7ef", borderRadius: "6px", padding: "8px", font: "inherit", fontSize: "12px" }}
                />
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="primary-btn" disabled={submitting}>
                {submitting ? "Saving Phone..." : "Save Phone to Inventory"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: BULK PHONE ENTRY & CSV IMPORT */}
      {showBulkModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: "860px", width: "95%" }}>
            <div className="modal-head">
              <div>
                <h2>Bulk Phone Entry & Import</h2>
                <p>Add multiple phones simultaneously via interactive rows or import a CSV/Excel file.</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowBulkModal(false)}>×</button>
            </div>

            {/* Mode Tabs */}
            <div style={{ display: "flex", gap: "10px", borderBottom: "1px solid #e2e8f0", marginBottom: "16px" }}>
              <button
                type="button"
                onClick={() => setBulkMode("rows")}
                style={{
                  padding: "8px 16px",
                  background: "none",
                  border: "none",
                  borderBottom: bulkMode === "rows" ? "3px solid #0176d3" : "3px solid transparent",
                  color: bulkMode === "rows" ? "#0176d3" : "#64748b",
                  fontWeight: bulkMode === "rows" ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                }}
              >
                <TableIcon size={15} /> Multi-Row Dynamic Entry
              </button>
              <button
                type="button"
                onClick={() => setBulkMode("csv")}
                style={{
                  padding: "8px 16px",
                  background: "none",
                  border: "none",
                  borderBottom: bulkMode === "csv" ? "3px solid #0176d3" : "3px solid transparent",
                  color: bulkMode === "csv" ? "#0176d3" : "#64748b",
                  fontWeight: bulkMode === "csv" ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                }}
              >
                <FileSpreadsheet size={15} /> CSV / Excel Import
              </button>
            </div>

            {/* TAB 1: DYNAMIC ROWS */}
            {bulkMode === "rows" && (
              <form onSubmit={handleSubmitDynamicRows}>
                <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span>↔️ Swipe horizontally to view all fields (Brand, Model, IMEI, Color, Storage, Issue):</span>
                </div>
                <div style={{ maxHeight: "360px", overflowY: "auto", overflowX: "auto", border: "1px solid #cbd5e1", borderRadius: "8px", marginBottom: "12px", WebkitOverflowScrolling: "touch" }}>
                  <table style={{ minWidth: "660px", width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
                    <thead style={{ background: "#f8fafc", position: "sticky", top: 0, zIndex: 1 }}>
                      <tr>
                        <th style={{ width: "40px" }}>#</th>
                        <th>Brand *</th>
                        <th>Model *</th>
                        <th style={{ minWidth: "170px" }}>IMEI (Camera / Manual)</th>
                        <th>Color</th>
                        <th>Storage</th>
                        <th>Initial Issue</th>
                        <th style={{ width: "40px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dynamicRows.map((row, idx) => (
                        <tr key={row.id}>
                          <td>{idx + 1}</td>
                          <td>
                            <input
                              required
                              placeholder="Brand"
                              value={row.brand}
                              onChange={(e) => updateDynamicRow(row.id, "brand", e.target.value)}
                              style={{ width: "100%", padding: "4px 6px", fontSize: "11px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                            />
                          </td>
                          <td>
                            <input
                              required
                              placeholder="Model"
                              value={row.model}
                              onChange={(e) => updateDynamicRow(row.id, "model", e.target.value)}
                              style={{ width: "100%", padding: "4px 6px", fontSize: "11px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                            />
                          </td>
                          <td>
                            <div style={{ position: "relative", display: "flex", alignItems: "center", minWidth: "160px" }}>
                              <input
                                placeholder="14-16 digits"
                                value={row.imei}
                                onChange={(e) => updateDynamicRow(row.id, "imei", e.target.value)}
                                style={{ width: "100%", padding: "4px 32px 4px 6px", fontSize: "11px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setScannerTargetRowId(row.id);
                                  setScannerOpen(true);
                                }}
                                title="Scan IMEI Barcode"
                                style={{
                                  position: "absolute",
                                  right: "3px",
                                  background: "#f0f7ff",
                                  border: "1px solid #bae6fd",
                                  borderRadius: "4px",
                                  color: "#0284c7",
                                  padding: "2px 5px",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                }}
                              >
                                <Camera size={13} />
                              </button>
                            </div>
                          </td>
                          <td>
                            <input
                              placeholder="Color"
                              value={row.color}
                              onChange={(e) => updateDynamicRow(row.id, "color", e.target.value)}
                              style={{ width: "80px", padding: "4px 6px", fontSize: "11px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                            />
                          </td>
                          <td>
                            <select
                              value={row.storage}
                              onChange={(e) => updateDynamicRow(row.id, "storage", e.target.value)}
                              style={{ padding: "4px", fontSize: "11px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                            >
                              <option value="64GB">64GB</option>
                              <option value="128GB">128GB</option>
                              <option value="256GB">256GB</option>
                              <option value="512GB">512GB</option>
                              <option value="1TB">1TB</option>
                            </select>
                          </td>
                          <td>
                            <input
                              placeholder="e.g. Scratches"
                              value={row.issue}
                              onChange={(e) => updateDynamicRow(row.id, "issue", e.target.value)}
                              style={{ width: "100%", padding: "4px 6px", fontSize: "11px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => removeDynamicRow(row.id)}
                              disabled={dynamicRows.length <= 1}
                              style={{ background: "none", border: "none", color: "#b42318", cursor: "pointer" }}
                              title="Delete row"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={addDynamicRow}
                    style={{ fontSize: "12px", padding: "7px 14px", display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 600 }}
                  >
                    <Plus size={15} /> Add Another Phone Row
                  </button>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Total Handsets to Register: <b>{dynamicRows.filter((r) => r.brand.trim() && r.model.trim()).length}</b>
                  </span>
                </div>

                {bulkResult && (
                  <div style={{ padding: "10px", background: "#f8fafc", borderRadius: "6px", fontSize: "12px", marginBottom: "10px" }}>
                    <b style={{ color: "#15945b" }}>Successfully registered {bulkResult.successCount} phone(s).</b>
                    {bulkResult.errors.length > 0 && (
                      <div style={{ marginTop: "6px", color: "#b42318" }}>
                        <b>Errors ({bulkResult.errors.length}):</b>
                        <ul style={{ margin: "4px 0 0 16px" }}>
                          {bulkResult.errors.map((err, idx) => <li key={idx}>{err}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div className="modal-actions">
                  <button type="button" className="secondary-btn" onClick={() => setShowBulkModal(false)}>Close</button>
                  <button className="primary-btn" disabled={submitting}>
                    {submitting ? "Registering All Phones..." : "Register All Phones"}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: CSV / EXCEL IMPORT */}
            {bulkMode === "csv" && (
              <form onSubmit={handleBulkCsvImport}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    Format: <code>Brand, Model, IMEI, Color, Storage, Issue</code>
                  </span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button type="button" className="secondary-btn" onClick={loadSampleCsv} style={{ fontSize: "11px", padding: "4px 8px" }}>
                      Load Sample Data
                    </button>
                    <label className="secondary-btn" style={{ fontSize: "11px", padding: "4px 8px", cursor: "pointer" }}>
                      <Upload size={12} /> Upload CSV File
                      <input type="file" accept=".csv,.txt" onChange={handleCsvFileUpload} style={{ display: "none" }} />
                    </label>
                  </div>
                </div>

                <textarea
                  rows={8}
                  placeholder={`Apple, iPhone 14, 354890098765431, Midnight, 128GB, Minor bezel dent\nSamsung, Galaxy S23, 354890098765432, Phantom Black, 256GB, None`}
                  value={bulkCsvText}
                  onChange={(e) => setBulkCsvText(e.target.value)}
                  style={{
                    width: "100%",
                    border: "1px solid #e0e7ef",
                    borderRadius: "6px",
                    padding: "8px",
                    fontFamily: "monospace",
                    fontSize: "11px",
                    lineHeight: "1.5",
                    marginBottom: "12px",
                  }}
                />

                {bulkResult && (
                  <div style={{ padding: "10px", background: "#f8fafc", borderRadius: "6px", fontSize: "12px", marginBottom: "10px" }}>
                    <b style={{ color: "#15945b" }}>Successfully imported {bulkResult.successCount} phone(s).</b>
                    {bulkResult.errors.length > 0 && (
                      <div style={{ marginTop: "6px", color: "#b42318" }}>
                        <b>Errors ({bulkResult.errors.length}):</b>
                        <ul style={{ margin: "4px 0 0 16px" }}>
                          {bulkResult.errors.map((err, idx) => <li key={idx}>{err}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div className="modal-actions">
                  <button type="button" className="secondary-btn" onClick={() => setShowBulkModal(false)}>Close</button>
                  <button className="primary-btn" disabled={submitting || !bulkCsvText.trim()}>
                    {submitting ? "Processing CSV..." : "Process Bulk Import"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: EDIT DEVICE */}
      {editingDevice && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleUpdateDevice} style={{ maxWidth: "560px" }}>
            <div className="modal-head">
              <div>
                <h2>Edit Handset Record</h2>
                <p>Modify specifications, status or condition for {editingDevice.brand} {editingDevice.model}.</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setEditingDevice(null)}>×</button>
            </div>

            <div className="form-grid">
              <label>
                Brand *
                <input required value={editBrand} onChange={(e) => setEditBrand(e.target.value)} />
              </label>

              <label>
                Model *
                <input required value={editModel} onChange={(e) => setEditModel(e.target.value)} />
              </label>

              <label>
                IMEI
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input
                    value={editImei}
                    onChange={(e) => setEditImei(e.target.value)}
                    style={{ width: "100%", paddingRight: "44px" }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setScannerTargetRowId("EDIT_DEVICE");
                      setScannerOpen(true);
                    }}
                    title="Scan IMEI Barcode with Camera"
                    style={{
                      position: "absolute",
                      right: "5px",
                      background: "#f0f7ff",
                      border: "1px solid #bae6fd",
                      borderRadius: "6px",
                      color: "#0284c7",
                      padding: "4px 8px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    <Camera size={15} />
                  </button>
                </div>
              </label>

              <label>
                Color
                <input value={editColor} onChange={(e) => setEditColor(e.target.value)} />
              </label>

              <label style={{ display: "grid", gap: "7px" }}>
                Storage
                <CustomSelect
                  value={editStorage}
                  onChange={(val) => setEditStorage(val)}
                  options={["64GB", "128GB", "256GB", "512GB", "1TB"]}
                  style={{ width: "100%" }}
                  minWidth="100%"
                  height="38px"
                />
              </label>

              <label style={{ display: "grid", gap: "7px" }}>
                Status *
                <CustomSelect
                  value={editStatus}
                  onChange={(val) => setEditStatus(val)}
                  options={statuses.filter((s) => s.value !== "all").map((s) => ({ value: s.value, label: s.label }))}
                  style={{ width: "100%" }}
                  minWidth="100%"
                  height="38px"
                />
              </label>

              <label>
                Purchase / Intake Cost (₹)
                <input
                  type="number"
                  min="0"
                  value={editPurchaseCost}
                  onChange={(e) => setEditPurchaseCost(e.target.value)}
                />
              </label>

              <label style={{ gridColumn: "1 / -1" }}>
                Reported Complaint / Issue
                <input
                  placeholder="e.g. Broken screen display, touch unresponsive"
                  value={editIssue}
                  onChange={(e) => setEditIssue(e.target.value)}
                />
              </label>
            </div>

            <div style={{ marginTop: "12px" }}>
              <label style={{ fontSize: "11px", color: "#687b92", display: "grid", gap: "4px" }}>
                Notes / Physical Condition Details
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  style={{ border: "1px solid #e0e7ef", borderRadius: "6px", padding: "8px", font: "inherit", fontSize: "12px" }}
                />
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setEditingDevice(null)}>Cancel</button>
              <button className="primary-btn" disabled={submitting}>
                {submitting ? "Saving..." : "Update Handset"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: DEVICE 360° LIFECYCLE VIEW */}
      {active360Device && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: "720px", width: "95%" }}>
            <div className="modal-head">
              <div>
                <span className="tag" style={{ background: "#edf5fc", color: "#0176d3", fontWeight: 700 }}>
                  Device 360° Source of Truth
                </span>
                <h2 style={{ marginTop: "6px" }}>
                  {active360Device.brand} {active360Device.model}
                </h2>
                <p>
                  IMEI: <code>{active360Device.imei1 || active360Device.imei || "None"}</code> | Storage: <b>{active360Device.storage_capacity || "128GB"}</b> | Status: <b>{formatDeviceStatus(active360Device.status)}</b>
                </p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setActive360Device(null)}>×</button>
            </div>

            {loading360 ? (
              <div className="empty">Loading 360° lifecycle timeline and financial costs…</div>
            ) : (
              <div>
                {/* Cost Rollup Card */}
                {costSummary && (
                  <div className="responsive-grid-4" style={{ gap: "10px", background: "#f8fafc", padding: "14px", borderRadius: "8px", border: "1px solid #e7edf5", marginBottom: "16px" }}>
                    <div>
                      <small style={{ color: "#8291a5", fontSize: "10px" }}>Acquisition Cost</small>
                      <b style={{ display: "block", fontSize: "15px" }}>₹{costSummary.purchase_cost.toLocaleString("en-IN")}</b>
                    </div>
                    <div>
                      <small style={{ color: "#8291a5", fontSize: "10px" }}>FIFO Parts Cost</small>
                      <b style={{ display: "block", fontSize: "15px", color: "#e68a2e" }}>₹{costSummary.parts_cost.toLocaleString("en-IN")}</b>
                    </div>
                    <div>
                      <small style={{ color: "#8291a5", fontSize: "10px" }}>Labour & Ops</small>
                      <b style={{ display: "block", fontSize: "15px", color: "#7955c7" }}>₹{costSummary.labor_cost.toLocaleString("en-IN")}</b>
                    </div>
                    <div>
                      <small style={{ color: "#8291a5", fontSize: "10px" }}>Cumulative Total Cost</small>
                      <b style={{ display: "block", fontSize: "15px", color: "#15945b" }}>₹{costSummary.total_cost.toLocaleString("en-IN")}</b>
                    </div>
                  </div>
                )}

                {/* Handset Hardware Condition & Intake Checklist Status */}
                <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                    <span className="checklist-section-title" style={{ margin: 0 }}>
                      <ShieldCheck size={14} /> Hardware Health & Diagnostics Overview
                    </span>
                    <span className="checklist-tag pass">
                      Intake Grade: {active360Device.condition || "Good"}
                    </span>
                  </div>

                  <div className="checklist-grid grid-2-col">
                    <div className="checklist-card is-passed" style={{ cursor: "default", minHeight: "48px" }}>
                      <div className="checklist-indicator" style={{ width: "20px", height: "20px" }}>
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <div className="checklist-body">
                        <div className="checklist-header-row">
                          <h4 className="checklist-label">Physical & Cosmetic Condition</h4>
                          <span className="checklist-tag pass">{active360Device.condition || "Good"}</span>
                        </div>
                        <p className="checklist-desc">
                          {active360Device.color ? `Color: ${active360Device.color}` : "Standard chassis"} • {active360Device.storage_capacity || "128GB"}
                        </p>
                      </div>
                    </div>

                    <div className={`checklist-card ${active360Device.initial_issue ? "is-defect" : "is-passed"}`} style={{ cursor: "default", minHeight: "48px" }}>
                      <div className="checklist-indicator" style={{ width: "20px", height: "20px" }}>
                        {active360Device.initial_issue ? <AlertCircle size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />}
                      </div>
                      <div className="checklist-body">
                        <div className="checklist-header-row">
                          <h4 className="checklist-label">Reported Hardware Defect</h4>
                          <span className={`checklist-tag ${active360Device.initial_issue ? "defect" : "pass"}`}>
                            {active360Device.initial_issue ? "DEFECT DETECTED" : "NO DEFECTS"}
                          </span>
                        </div>
                        <p className="checklist-desc">
                          {active360Device.initial_issue || "No hardware faults reported at intake"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline Events Feed */}
                <h4 style={{ fontSize: "13px", fontWeight: 700, color: "#152b49", marginBottom: "10px" }}>
                  Lifecycle Activity Timeline
                </h4>
                {timeline.length === 0 ? (
                  <div className="empty">No timeline milestones recorded yet for this device.</div>
                ) : (
                  <div style={{ display: "grid", gap: "8px", maxHeight: "280px", overflowY: "auto" }}>
                    {timeline.map((evt) => (
                      <div
                        key={evt.id}
                        style={{
                          display: "flex",
                          gap: "12px",
                          padding: "10px 14px",
                          background: "#fff",
                          border: "1px solid #eef2f6",
                          borderRadius: "6px",
                          alignItems: "flex-start",
                        }}
                      >
                        <div style={{ color: "#0176d3", marginTop: "2px" }}><CheckCircle2 size={16} /></div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                            <b style={{ fontSize: "12px", color: "#152b49" }}>{evt.title}</b>
                            <span style={{ fontSize: "10px", color: "#8291a5" }}>
                              {new Date(evt.created_at).toLocaleString("en-IN")}
                            </span>
                          </div>
                          {evt.description && (
                            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#4f627a" }}>
                              {evt.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: "16px" }}>
              <button type="button" className="secondary-btn" onClick={() => setActive360Device(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Camera IMEI Barcode / QR Scanner Modal */}
      <CameraImeiScanner
        isOpen={scannerOpen}
        onClose={() => {
          setScannerOpen(false);
          setScannerTargetRowId(null);
        }}
        onScan={handleScannedImei}
        title={
          scannerTargetRowId === "EDIT_DEVICE"
            ? "Scan IMEI for Handset Edit"
            : scannerTargetRowId
            ? "Scan IMEI for Bulk Entry Row"
            : "Scan Handset IMEI Barcode"
        }
      />
    </>
  );
}
