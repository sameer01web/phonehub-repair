import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Headphones,
  Search,
  Plus,
  RefreshCw,
  Barcode,
  AlertTriangle,
  Package,
  Layers,
  ArrowUpDown,
  Edit2,
  Trash2,
  PlusCircle,
  MinusCircle,
  CheckCircle2,
  X,
  TrendingUp,
  Tag,
  DollarSign,
  ShieldAlert,
} from "lucide-react";
import {
  getAccessories,
  createAccessory,
  updateAccessory,
  deleteAccessory,
  adjustAccessoryStock,
  findAccessoryByBarcode,
  getAccessoriesMetrics,
} from "../lib/accessories";
import type { Accessory, AccessoryCategory } from "../lib/types";
import CustomSelect from "../components/CustomSelect";

const CATEGORIES: { label: string; value: AccessoryCategory | "all" }[] = [
  { label: "All Items", value: "all" },
  { label: "Chargers", value: "Chargers" },
  { label: "USB Cables", value: "USB cables" },
  { label: "Mobile Covers", value: "Mobile covers" },
  { label: "Tempered Glass", value: "Tempered glass" },
  { label: "Earphones", value: "Earphones" },
  { label: "Power Banks", value: "Power banks" },
  { label: "Other Accessories", value: "Other" },
];

export default function AccessoriesPage() {
  const [items, setItems] = useState<Accessory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"default" | "stock" | "purchase" | "retail">("default");

  // Scanned item modal or quick lookup
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scannedItem, setScannedItem] = useState<Accessory | null>(null);
  const [scanMessage, setScanMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Accessory | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "Chargers" as AccessoryCategory,
    sku: "",
    barcode: "",
    purchase_price: "",
    selling_price: "",
    current_stock: "",
    minimum_stock: "5",
    notes: "",
  });

  // Stock Adjustment Modal
  const [adjustingItem, setAdjustingItem] = useState<Accessory | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustType, setAdjustType] = useState<"add" | "remove">("add");
  const [adjustReason, setAdjustReason] = useState<string>("Restocked inventory");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load items
  async function loadData() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getAccessories(selectedCategory, search);
      setItems(data);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to load accessories");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedCategory, search]);

  // USB Barcode Scanner support (listening for rapid keystrokes or Enter key)
  const barcodeBufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Do not intercept if user is typing into an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
        return;
      }

      const currentTime = Date.now();
      if (currentTime - lastKeyTimeRef.current > 100) {
        barcodeBufferRef.current = "";
      }
      lastKeyTimeRef.current = currentTime;

      if (e.key === "Enter") {
        if (barcodeBufferRef.current.trim().length >= 4) {
          handleScannedBarcode(barcodeBufferRef.current.trim());
          barcodeBufferRef.current = "";
        }
      } else if (e.key.length === 1) {
        barcodeBufferRef.current += e.key;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items]);

  // Handle scanned barcode lookup
  async function handleScannedBarcode(code: string) {
    if (!code) return;
    setScanMessage({ text: `Searching barcode: ${code}...`, type: "info" });
    const match = await findAccessoryByBarcode(code);
    if (match) {
      setScannedItem(match);
      setScanMessage({ text: `Found: ${match.name} (${match.sku}) - Stock: ${match.current_stock}`, type: "success" });
    } else {
      setScanMessage({ text: `No accessory found for barcode: ${code}`, type: "error" });
    }
  }

  // Filter and sort items for display
  const displayItems = useMemo(() => {
    let list = items.filter((item) => {
      if (lowStockOnly && item.current_stock > item.minimum_stock) {
        return false;
      }
      return true;
    });

    if (sortBy === "stock") {
      list = [...list].sort((a, b) => Number(b.current_stock || 0) - Number(a.current_stock || 0));
    } else if (sortBy === "purchase") {
      list = [...list].sort(
        (a, b) =>
          Number(b.current_stock || 0) * Number(b.purchase_price || 0) -
          Number(a.current_stock || 0) * Number(a.purchase_price || 0)
      );
    } else if (sortBy === "retail") {
      list = [...list].sort(
        (a, b) =>
          Number(b.current_stock || 0) * Number(b.selling_price || 0) -
          Number(a.current_stock || 0) * Number(a.selling_price || 0)
      );
    }

    return list;
  }, [items, lowStockOnly, sortBy]);

  // Calculate metrics
  const totalSkus = items.length;
  const totalUnits = items.reduce((sum, item) => sum + Number(item.current_stock || 0), 0);
  const totalValuation = items.reduce(
    (sum, item) => sum + Number(item.current_stock || 0) * Number(item.purchase_price || 0),
    0
  );
  const potentialRevenue = items.reduce(
    (sum, item) => sum + Number(item.current_stock || 0) * Number(item.selling_price || 0),
    0
  );
  const lowStockCount = items.filter((item) => item.current_stock <= item.minimum_stock).length;

  // Open modal for Create
  function openCreateModal() {
    setEditingItem(null);
    const randBarcode = "890" + Math.floor(1000000000 + Math.random() * 9000000000);
    const randSku = "ACC-" + Math.floor(1000 + Math.random() * 9000);
    setFormData({
      name: "",
      category: "Chargers",
      sku: randSku,
      barcode: randBarcode,
      purchase_price: "",
      selling_price: "",
      current_stock: "10",
      minimum_stock: "5",
      notes: "",
    });
    setErrorMsg(null);
    setIsModalOpen(true);
  }

  // Open modal for Edit
  function openEditModal(item: Accessory) {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      sku: item.sku,
      barcode: item.barcode || "",
      purchase_price: item.purchase_price.toString(),
      selling_price: item.selling_price.toString(),
      current_stock: item.current_stock.toString(),
      minimum_stock: item.minimum_stock.toString(),
      notes: item.notes || "",
    });
    setErrorMsg(null);
    setIsModalOpen(true);
  }

  // Save Add/Edit
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg("Please provide an accessory product name.");
      return;
    }
    if (!formData.sku.trim()) {
      setErrorMsg("SKU is required.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      if (editingItem) {
        await updateAccessory(editingItem.id, {
          name: formData.name.trim(),
          category: formData.category,
          sku: formData.sku.trim().toUpperCase(),
          barcode: formData.barcode.trim() || undefined,
          purchase_price: Number(formData.purchase_price) || 0,
          selling_price: Number(formData.selling_price) || 0,
          current_stock: Number(formData.current_stock) || 0,
          minimum_stock: Number(formData.minimum_stock) || 0,
          notes: formData.notes.trim() || undefined,
        });
      } else {
        await createAccessory({
          name: formData.name.trim(),
          category: formData.category,
          sku: formData.sku.trim().toUpperCase(),
          barcode: formData.barcode.trim() || undefined,
          purchase_price: Number(formData.purchase_price) || 0,
          selling_price: Number(formData.selling_price) || 0,
          current_stock: Number(formData.current_stock) || 0,
          minimum_stock: Number(formData.minimum_stock) || 0,
          notes: formData.notes.trim() || undefined,
        });
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save accessory");
    } finally {
      setSaving(false);
    }
  }

  // Delete
  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Are you sure you want to delete "${name}" from inventory?`)) {
      return;
    }
    try {
      await deleteAccessory(id);
      await loadData();
    } catch (err: any) {
      alert("Error deleting accessory: " + (err?.message || "Unknown error"));
    }
  }

  // Adjust stock
  async function handleStockAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustingItem) return;
    if (adjustQty <= 0) {
      alert("Please enter a quantity greater than zero.");
      return;
    }

    const changeQty = adjustType === "add" ? adjustQty : -adjustQty;

    setSaving(true);
    try {
      await adjustAccessoryStock(adjustingItem.id, changeQty, adjustReason);
      setAdjustingItem(null);
      await loadData();
    } catch (err: any) {
      alert("Stock adjustment failed: " + (err?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="page-head">
        <div>
          <h1>Accessories Inventory</h1>
          <p>Chargers, USB cables, mobile covers, tempered glass, earphones, and power banks.</p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button className="secondary-btn" onClick={loadData} title="Refresh">
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            Refresh
          </button>
          <button className="primary-btn" onClick={openCreateModal}>
            <Plus size={16} />
            Add Accessory
          </button>
        </div>
      </div>

      {/* Metrics Banner (Clickable Interactive Cards) */}
      <div className="responsive-grid-5" style={{ marginBottom: "22px" }}>
        <div
          className={`stat-card clickable ${!lowStockOnly && sortBy === "default" && selectedCategory === "all" ? "active" : ""}`}
          onClick={() => {
            setLowStockOnly(false);
            setSelectedCategory("all");
            setSortBy("default");
          }}
          style={{ cursor: "pointer", position: "relative" }}
          title="Click to view all accessories (reset filters)"
        >
          <div className="stat-icon Blue">
            <Tag size={18} />
          </div>
          <div className="stat-label">Total Product SKUs</div>
          <div className="stat-value">{totalSkus}</div>
          <div className="stat-foot">Catalogued items</div>
        </div>

        <div
          className={`stat-card clickable ${sortBy === "stock" ? "active" : ""}`}
          onClick={() => {
            setLowStockOnly(false);
            setSortBy(sortBy === "stock" ? "default" : "stock");
          }}
          style={{ cursor: "pointer", position: "relative" }}
          title="Click to sort products by highest units in stock"
        >
          <div className="stat-icon Purple">
            <Package size={18} />
          </div>
          <div className="stat-label">Total Units in Stock</div>
          <div className="stat-value">{totalUnits}</div>
          <div className="stat-foot">{sortBy === "stock" ? "Sorted: High to low stock" : "Units on rack/shelves"}</div>
        </div>

        <div
          className={`stat-card clickable ${sortBy === "purchase" ? "active" : ""}`}
          onClick={() => {
            setLowStockOnly(false);
            setSortBy(sortBy === "purchase" ? "default" : "purchase");
          }}
          style={{ cursor: "pointer", position: "relative" }}
          title="Click to sort products by highest purchase inventory cost"
        >
          <div className="stat-icon Green">
            <DollarSign size={18} />
          </div>
          <div className="stat-label">Purchase Valuation</div>
          <div className="stat-value">₹{totalValuation.toLocaleString()}</div>
          <div className="stat-foot">{sortBy === "purchase" ? "Sorted: High to low valuation" : "Cost of inventory"}</div>
        </div>

        <div
          className={`stat-card clickable ${sortBy === "retail" ? "active" : ""}`}
          onClick={() => {
            setLowStockOnly(false);
            setSortBy(sortBy === "retail" ? "default" : "retail");
          }}
          style={{ cursor: "pointer", position: "relative" }}
          title="Click to sort products by expected retail sales value"
        >
          <div className="stat-icon Blue">
            <TrendingUp size={18} />
          </div>
          <div className="stat-label">Retail Value</div>
          <div className="stat-value">₹{potentialRevenue.toLocaleString()}</div>
          <div className="stat-foot">{sortBy === "retail" ? "Sorted: High to low retail value" : "Expected sales value"}</div>
        </div>

        <div
          className={`stat-card clickable ${lowStockOnly ? "active" : ""}`}
          onClick={() => {
            setSortBy("default");
            setLowStockOnly(!lowStockOnly);
          }}
          style={{ cursor: "pointer", position: "relative" }}
          title="Click to filter products below minimum stock level"
        >
          <div className="stat-icon Orange">
            <AlertTriangle size={18} />
          </div>
          <div className="stat-label">Low Stock Alerts</div>
          <div className="stat-value" style={{ color: lowStockCount > 0 ? "#b42318" : "#15945b" }}>
            {lowStockCount}
          </div>
          <div className="stat-foot">{lowStockOnly ? "Filtered: Low stock items only" : "Below minimum reorder level"}</div>
        </div>
      </div>

      {/* Barcode Scanner Bar */}
      <div
        className="panel"
        style={{
          padding: "16px 20px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          marginBottom: "18px",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "#e0f2fe",
                color: "#0369a1",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Barcode size={20} />
            </div>
            <div>
              <b style={{ fontSize: "13px", color: "#1e293b" }}>USB & Manual Barcode Scanner</b>
              <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>
                Scan using any handheld USB barcode scanner or type/paste barcode manually:
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleScannedBarcode(barcodeInput);
            }}
            style={{ display: "flex", gap: "8px", alignItems: "center" }}
          >
            <input
              type="text"
              placeholder="Enter/Scan Barcode..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              style={{
                height: "36px",
                padding: "0 12px",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                fontSize: "12px",
                minWidth: "220px",
                background: "#fff",
              }}
            />
            <button type="submit" className="primary-btn" style={{ height: "36px", padding: "0 14px" }}>
              Lookup
            </button>
            {barcodeInput && (
              <button
                type="button"
                className="secondary-btn"
                style={{ height: "36px", padding: "0 10px" }}
                onClick={() => {
                  setBarcodeInput("");
                  setScanMessage(null);
                  setScannedItem(null);
                }}
              >
                Clear
              </button>
            )}
          </form>
        </div>

        {scanMessage && (
          <div
            style={{
              marginTop: "12px",
              padding: "8px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 500,
              background:
                scanMessage.type === "success"
                  ? "#e8f8f0"
                  : scanMessage.type === "error"
                  ? "#fee2e2"
                  : "#eff6ff",
              color:
                scanMessage.type === "success"
                  ? "#15803d"
                  : scanMessage.type === "error"
                  ? "#991b1b"
                  : "#1d4ed8",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{scanMessage.text}</span>
            {scannedItem && (
              <button
                className="secondary-btn"
                style={{ padding: "4px 8px", fontSize: "11px" }}
                onClick={() => setAdjustingItem(scannedItem)}
              >
                Adjust Stock
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Table Panel */}
      <div className="panel">
        {/* Toolbar & Filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", marginBottom: "16px" }}>
          {/* Category Tabs */}
          <div className="pill-filter-bar" style={{ flex: 1 }}>
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setSelectedCategory(c.value)}
                style={{
                  border: 0,
                  borderRadius: "20px",
                  padding: "6px 14px",
                  fontSize: "11px",
                  fontWeight: selectedCategory === c.value ? 700 : 500,
                  background: selectedCategory === c.value ? "#0176d3" : "#f1f4f8",
                  color: selectedCategory === c.value ? "#fff" : "#475569",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Low Stock Toggle */}
          <button
            onClick={() => setLowStockOnly(!lowStockOnly)}
            style={{
              border: lowStockOnly ? "1px solid #f97316" : "1px solid #cbd5e1",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "11px",
              fontWeight: 600,
              background: lowStockOnly ? "#fff7ed" : "#fff",
              color: lowStockOnly ? "#c2410c" : "#475569",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <AlertTriangle size={14} color={lowStockOnly ? "#ea580c" : "#94a3b8"} />
            Low Stock Only ({lowStockCount})
          </button>

          {/* Search Box */}
          <div className="searchbox" style={{ width: "240px", height: "34px" }}>
            <Search size={14} />
            <input
              type="text"
              placeholder="Search SKU, name, barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* 1. Desktop View: Table */}
        <div className="table-wrap desktop-accessories-table">
          <table>
            <thead>
              <tr>
                <th>Product SKU</th>
                <th>Product Name & Category</th>
                <th>Barcode</th>
                <th>Purchase Cost</th>
                <th>Retail Price</th>
                <th>Current Stock</th>
                <th>Stock Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                    Loading accessories catalogue...
                  </td>
                </tr>
              ) : displayItems.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                    <div style={{ marginBottom: "8px" }}>No accessories match your current filters.</div>
                    <button className="primary-btn" onClick={openCreateModal} style={{ fontSize: "11px", padding: "6px 12px" }}>
                      <Plus size={14} /> Add First Accessory
                    </button>
                  </td>
                </tr>
              ) : (
                displayItems.map((item) => {
                  const isLow = item.current_stock <= item.minimum_stock;
                  const isOut = item.current_stock <= 0;

                  return (
                    <tr key={item.id}>
                      {/* SKU */}
                      <td>
                        <b style={{ color: "#0176d3", fontFamily: "monospace", fontSize: "12px" }}>
                          {item.sku}
                        </b>
                      </td>

                      {/* Name & Category */}
                      <td>
                        <b style={{ color: "#1e293b", display: "block" }}>{item.name}</b>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
                          <span
                            className="tag"
                            style={{
                              fontSize: "10px",
                              padding: "2px 8px",
                              background: "#f1f5f9",
                              color: "#475569",
                            }}
                          >
                            {item.category}
                          </span>
                          {item.notes && (
                            <span style={{ fontSize: "10px", color: "#94a3b8" }}>{item.notes}</span>
                          )}
                        </div>
                      </td>

                      {/* Barcode */}
                      <td>
                        {item.barcode ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "#475569" }}>
                            <Barcode size={13} className="muted" />
                            <span style={{ fontFamily: "monospace", fontSize: "11px" }}>{item.barcode}</span>
                          </div>
                        ) : (
                          <span style={{ color: "#cbd5e1", fontSize: "10px" }}>No Barcode</span>
                        )}
                      </td>

                      {/* Purchase Cost */}
                      <td>
                        <b style={{ color: "#334155" }}>₹{Number(item.purchase_price).toFixed(2)}</b>
                      </td>

                      {/* Retail Price */}
                      <td>
                        <b style={{ color: "#059669" }}>₹{Number(item.selling_price).toFixed(2)}</b>
                      </td>

                      {/* Stock Level */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <b style={{ fontSize: "13px", color: isOut ? "#dc2626" : isLow ? "#d97706" : "#0f172a" }}>
                            {item.current_stock}
                          </b>
                          <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                            (Min: {item.minimum_stock})
                          </span>
                        </div>
                      </td>

                      {/* Stock Status Badge */}
                      <td>
                        {isOut ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "3px 8px",
                              borderRadius: "12px",
                              fontSize: "10px",
                              fontWeight: 700,
                              background: "#fee2e2",
                              color: "#dc2626",
                            }}
                          >
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "3px 8px",
                              borderRadius: "12px",
                              fontSize: "10px",
                              fontWeight: 700,
                              background: "#fef3c7",
                              color: "#b45309",
                            }}
                          >
                            Low Stock Alert
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "3px 8px",
                              borderRadius: "12px",
                              fontSize: "10px",
                              fontWeight: 600,
                              background: "#e8f8f0",
                              color: "#15803d",
                            }}
                          >
                            In Stock
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                          {/* Quick Adjust Button */}
                          <button
                            onClick={() => {
                              setAdjustingItem(item);
                              setAdjustQty(1);
                              setAdjustType("add");
                              setAdjustReason("Restocked inventory");
                            }}
                            title="Adjust Stock Level"
                            style={{
                              background: "#f1f5f9",
                              border: 0,
                              borderRadius: "5px",
                              padding: "5px 8px",
                              fontSize: "11px",
                              color: "#334155",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <ArrowUpDown size={12} />
                            Stock
                          </button>

                          {/* Edit Button */}
                          <button
                            onClick={() => openEditModal(item)}
                            title="Edit Accessory"
                            style={{
                              background: "#e0f2fe",
                              border: 0,
                              borderRadius: "5px",
                              padding: "5px 8px",
                              fontSize: "11px",
                              color: "#0369a1",
                              cursor: "pointer",
                            }}
                          >
                            <Edit2 size={12} />
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDelete(item.id, item.name)}
                            title="Delete"
                            style={{
                              background: "#fee2e2",
                              border: 0,
                              borderRadius: "5px",
                              padding: "5px 8px",
                              fontSize: "11px",
                              color: "#b91c1c",
                              cursor: "pointer",
                            }}
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

        {/* 2. Mobile View: Touch-Friendly Accessory Cards */}
        <div className="mobile-accessories-cards">
          {loading ? (
            <div style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
              Loading accessories catalogue...
            </div>
          ) : displayItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px", color: "#64748b", background: "#f8fafc", borderRadius: "8px" }}>
              <div style={{ marginBottom: "8px" }}>No accessories match your current filters.</div>
              <button className="primary-btn" onClick={openCreateModal} style={{ fontSize: "11px", padding: "6px 12px" }}>
                <Plus size={14} /> Add First Accessory
              </button>
            </div>
          ) : (
            displayItems.map((item) => {
              const isLow = item.current_stock <= item.minimum_stock;
              const isOut = item.current_stock <= 0;

              return (
                <div key={item.id} className="mobile-accessory-card">
                  {/* Header: Name, SKU, Status */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: "11px", color: "#0176d3", fontFamily: "monospace", marginTop: "2px" }}>
                        {item.sku}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                      <span className="tag" style={{ fontSize: "10px", padding: "2px 8px", background: "#f1f5f9", color: "#475569" }}>
                        {item.category}
                      </span>
                      {isOut ? (
                        <span style={{ padding: "3px 8px", borderRadius: "12px", fontSize: "10px", fontWeight: 700, background: "#fee2e2", color: "#dc2626" }}>
                          Out of Stock
                        </span>
                      ) : isLow ? (
                        <span style={{ padding: "3px 8px", borderRadius: "12px", fontSize: "10px", fontWeight: 700, background: "#fef3c7", color: "#b45309" }}>
                          Low Stock
                        </span>
                      ) : (
                        <span style={{ padding: "3px 8px", borderRadius: "12px", fontSize: "10px", fontWeight: 600, background: "#e8f8f0", color: "#15803d" }}>
                          In Stock
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metrics: Stock, Retail Price, Cost */}
                  <div className="mobile-part-metrics" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                    <div className="mobile-part-metric-item">
                      <span style={{ fontSize: "10px", color: "#64748b" }}>Stock Level</span>
                      <b style={{ fontSize: "13.5px", color: isOut ? "#dc2626" : isLow ? "#d97706" : "#0f172a" }}>
                        {item.current_stock} <span style={{ fontSize: "10px", fontWeight: 400, color: "#94a3b8" }}>(Min {item.minimum_stock})</span>
                      </b>
                    </div>
                    <div className="mobile-part-metric-item">
                      <span style={{ fontSize: "10px", color: "#64748b" }}>Retail / Sell</span>
                      <b style={{ fontSize: "13px", color: "#059669" }}>
                        ₹{Number(item.selling_price).toFixed(2)}
                      </b>
                    </div>
                    <div className="mobile-part-metric-item">
                      <span style={{ fontSize: "10px", color: "#64748b" }}>Cost Price</span>
                      <b style={{ fontSize: "13px", color: "#334155" }}>
                        ₹{Number(item.purchase_price).toFixed(2)}
                      </b>
                    </div>
                  </div>

                  {/* Barcode & Notes */}
                  {(item.barcode || item.notes) && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "#64748b" }}>
                      {item.barcode && (
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <Barcode size={12} className="muted" />
                          <code style={{ fontSize: "11px" }}>{item.barcode}</code>
                        </div>
                      )}
                      {item.notes && <span style={{ fontStyle: "italic", color: "#8292a8" }}>{item.notes}</span>}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", paddingTop: "8px", borderTop: "1px dashed #e2e8f0" }}>
                    <button
                      onClick={() => {
                        setAdjustingItem(item);
                        setAdjustQty(1);
                        setAdjustType("add");
                        setAdjustReason("Restocked inventory");
                      }}
                      style={{
                        background: "#f1f5f9",
                        border: 0,
                        borderRadius: "6px",
                        padding: "6px 10px",
                        fontSize: "11.5px",
                        color: "#334155",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        flex: 1,
                        justifyContent: "center",
                        fontWeight: 600,
                      }}
                    >
                      <ArrowUpDown size={13} /> Adjust Stock
                    </button>
                    <button
                      onClick={() => openEditModal(item)}
                      style={{
                        background: "#e0f2fe",
                        border: 0,
                        borderRadius: "6px",
                        padding: "6px 12px",
                        fontSize: "11.5px",
                        color: "#0369a1",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontWeight: 600,
                      }}
                    >
                      <Edit2 size={13} /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.name)}
                      style={{
                        background: "#fee2e2",
                        border: 0,
                        borderRadius: "6px",
                        padding: "6px 10px",
                        fontSize: "11.5px",
                        color: "#b91c1c",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add / Edit Accessory Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ width: "min(600px, 95%)" }}>
            <div className="modal-head">
              <div>
                <h2>{editingItem ? "Edit Accessory" : "Add New Accessory"}</h2>
                <p>Register accessory SKU, barcode, pricing, and stock alert levels.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: "transparent", border: 0, cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            {errorMsg && (
              <div
                style={{
                  padding: "10px 14px",
                  marginBottom: "16px",
                  borderRadius: "6px",
                  background: "#fee2e2",
                  color: "#991b1b",
                  fontSize: "12px",
                }}
              >
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSave}>
              <div className="form-grid">
                {/* Product Name */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label>
                    Product Name *
                    <input
                      type="text"
                      placeholder="e.g. 20W Fast Type-C Charger"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </label>
                </div>

                {/* Category */}
                <div>
                  <label style={{ display: "grid", gap: "7px", fontSize: "10px", color: "#687b92" }}>
                    Category *
                    <CustomSelect
                      value={formData.category}
                      onChange={(val) => setFormData({ ...formData, category: val as AccessoryCategory })}
                      options={[
                        { value: "Chargers", label: "Chargers" },
                        { value: "USB cables", label: "USB cables" },
                        { value: "Mobile covers", label: "Mobile covers" },
                        { value: "Tempered glass", label: "Tempered glass" },
                        { value: "Earphones", label: "Earphones" },
                        { value: "Power banks", label: "Power banks" },
                        { value: "Other", label: "Other" },
                      ]}
                      style={{ width: "100%" }}
                      minWidth="100%"
                      height="38px"
                    />
                  </label>
                </div>

                {/* SKU */}
                <div>
                  <label>
                    SKU Code *
                    <input
                      type="text"
                      placeholder="e.g. CHG-20W-PD"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      required
                    />
                  </label>
                </div>

                {/* Barcode */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label>
                    Barcode (EAN-13 / UPC / Custom)
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="text"
                        placeholder="Scan or enter barcode"
                        value={formData.barcode}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="secondary-btn"
                        style={{ fontSize: "11px" }}
                        onClick={() => {
                          const rand = "890" + Math.floor(1000000000 + Math.random() * 9000000000);
                          setFormData({ ...formData, barcode: rand });
                        }}
                      >
                        Generate
                      </button>
                    </div>
                  </label>
                </div>

                {/* Purchase Price */}
                <div>
                  <label>
                    Purchase / Cost Price (₹) *
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.purchase_price}
                      onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                      required
                    />
                  </label>
                </div>

                {/* Selling Price */}
                <div>
                  <label>
                    Retail / Selling Price (₹) *
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.selling_price}
                      onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                      required
                    />
                  </label>
                </div>

                {/* Current Stock */}
                <div>
                  <label>
                    Current Stock Quantity *
                    <input
                      type="number"
                      min="0"
                      value={formData.current_stock}
                      onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })}
                      required
                    />
                  </label>
                </div>

                {/* Minimum Stock */}
                <div>
                  <label>
                    Minimum Stock Alert Level *
                    <input
                      type="number"
                      min="0"
                      value={formData.minimum_stock}
                      onChange={(e) => setFormData({ ...formData, minimum_stock: e.target.value })}
                      required
                    />
                  </label>
                </div>

                {/* Notes */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label>
                    Notes / Compatibility (Optional)
                    <input
                      type="text"
                      placeholder="e.g. Compatible with Samsung Galaxy S23 & iPhone 15"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </label>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: "24px" }}>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={saving}>
                  {saving ? "Saving..." : editingItem ? "Update Accessory" : "Add Accessory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustingItem && (
        <div className="modal-backdrop">
          <div className="modal" style={{ width: "min(460px, 95%)" }}>
            <div className="modal-head">
              <div>
                <h2>Adjust Stock Level</h2>
                <p>
                  <b>{adjustingItem.name}</b> (SKU: {adjustingItem.sku})
                </p>
              </div>
              <button
                onClick={() => setAdjustingItem(null)}
                style={{ background: "transparent", border: 0, cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                padding: "12px",
                background: "#f1f5f9",
                borderRadius: "8px",
                marginBottom: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "12px", color: "#475569" }}>Current In Stock:</span>
              <b style={{ fontSize: "18px", color: "#0176d3" }}>{adjustingItem.current_stock} units</b>
            </div>

            <form onSubmit={handleStockAdjust}>
              <div style={{ display: "grid", gap: "14px" }}>
                {/* Adjust Type */}
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType("add");
                      setAdjustReason("Restocked inventory");
                    }}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "6px",
                      border: adjustType === "add" ? "2px solid #16a34a" : "1px solid #cbd5e1",
                      background: adjustType === "add" ? "#f0fdf4" : "#fff",
                      color: adjustType === "add" ? "#15803d" : "#475569",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    <PlusCircle size={16} /> Add Stock (+)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType("remove");
                      setAdjustReason("Damaged / Defective piece");
                    }}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "6px",
                      border: adjustType === "remove" ? "2px solid #dc2626" : "1px solid #cbd5e1",
                      background: adjustType === "remove" ? "#fef2f2" : "#fff",
                      color: adjustType === "remove" ? "#b91c1c" : "#475569",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    <MinusCircle size={16} /> Deduct Stock (-)
                  </button>
                </div>

                {/* Quantity */}
                <div>
                  <label style={{ fontSize: "11px", color: "#475569", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                    Quantity to {adjustType === "add" ? "Add" : "Deduct"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{
                      width: "100%",
                      height: "38px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      padding: "0 10px",
                      fontSize: "14px",
                      fontWeight: 700,
                    }}
                    required
                  />
                </div>

                {/* Reason */}
                <div>
                  <label style={{ fontSize: "11px", color: "#475569", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                    Adjustment Reason
                  </label>
                  <CustomSelect
                    value={adjustReason}
                    onChange={(val) => setAdjustReason(val)}
                    options={
                      adjustType === "add"
                        ? [
                            { value: "Restocked inventory", label: "Restocked inventory" },
                            { value: "Supplier sample", label: "Supplier sample" },
                            { value: "Stock audit correction", label: "Stock audit correction" },
                          ]
                        : [
                            { value: "Damaged / Defective piece", label: "Damaged / Defective piece" },
                            { value: "Internal workshop use", label: "Internal workshop use" },
                            { value: "Direct counter sale", label: "Direct counter sale" },
                            { value: "Stock audit correction", label: "Stock audit correction" },
                          ]
                    }
                    style={{ width: "100%" }}
                    minWidth="100%"
                    height="38px"
                  />
                </div>

                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                  New Stock Level will be:{" "}
                  <b>
                    {adjustType === "add"
                      ? adjustingItem.current_stock + adjustQty
                      : Math.max(0, adjustingItem.current_stock - adjustQty)}{" "}
                    units
                  </b>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: "20px" }}>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setAdjustingItem(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={saving}>
                  {saving ? "Updating..." : "Confirm Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
