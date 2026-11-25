import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart3,
  RefreshCw,
  Layers,
  Wrench,
  Smartphone,
  ShieldCheck,
  TrendingUp,
  FileSpreadsheet,
  Users,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Printer,
  ChevronRight,
  Package,
  Activity,
  ArrowUpRight,
  FileText,
  Headphones,
  Tag,
  DollarSign,
} from "lucide-react";
import { getSpareParts, getInventoryBatches, getStockLedger } from "../lib/inventory";
import { getAccessories } from "../lib/accessories";
import CustomSelect from "../components/CustomSelect";
import {
  getDevices,
  getJobCards,
  getQcChecks,
  getStaffProfiles,
  normalizeDeviceStatus,
  formatDeviceStatus,
} from "../lib/repairs";
import type {
  Part,
  InventoryBatch,
  Device,
  Job,
  QcCheck,
  StockLedgerEntry,
  Profile,
  Accessory,
} from "../lib/types";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"technicians" | "operations" | "inventory" | "qc" | "accessories">("technicians");
  const [parts, setParts] = useState<Part[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [qcList, setQcList] = useState<QcCheck[]>([]);
  const [ledger, setLedger] = useState<StockLedgerEntry[]>([]);
  const [staffList, setStaffList] = useState<Profile[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateRange, setDateRange] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedTechId, setSelectedTechId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  async function loadReportData() {
    setLoading(true);
    try {
      const [p, b, d, j, q, l, s, acc] = await Promise.all([
        getSpareParts(),
        getInventoryBatches(),
        getDevices(),
        getJobCards(),
        getQcChecks(),
        getStockLedger(),
        getStaffProfiles(),
        getAccessories(),
      ]);
      setParts(p);
      setBatches(b);
      setDevices(d);
      setJobs(j);
      setQcList(q);
      setLedger(l);
      setStaffList(s);
      setAccessories(acc);
    } catch (err) {
      console.warn("Could not load reports data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReportData();
  }, []);

  // Filter jobs by date range
  const filteredJobsByDate = useMemo(() => {
    const now = new Date();
    return jobs.filter((job) => {
      const jobDateStr = job.created_at;
      if (!jobDateStr) return true;
      const jobDate = new Date(jobDateStr);
      if (isNaN(jobDate.getTime())) return true;

      if (dateRange === "today") {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return jobDate >= todayStart;
      }
      if (dateRange === "week") {
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return jobDate >= weekStart;
      }
      if (dateRange === "month") {
        const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return jobDate >= monthStart;
      }
      if (dateRange === "custom") {
        if (customStart) {
          const start = new Date(customStart);
          if (jobDate < start) return false;
        }
        if (customEnd) {
          const end = new Date(customEnd);
          end.setHours(23, 59, 59, 999);
          if (jobDate > end) return false;
        }
        return true;
      }
      return true; // 'all'
    });
  }, [jobs, dateRange, customStart, customEnd]);

  // Filter jobs by technician & search
  const visibleJobs = useMemo(() => {
    return filteredJobsByDate.filter((job) => {
      // Tech filter
      if (selectedTechId !== "all") {
        const hasAssignment = job.assignments?.some((a) => a.technician_id === selectedTechId);
        if (!hasAssignment) return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const numMatch = String(job.job_number || "").includes(q);
        const brandMatch = (job.device?.brand || "").toLowerCase().includes(q);
        const modelMatch = (job.device?.model || "").toLowerCase().includes(q);
        const imeiMatch = (job.device?.imei || "").toLowerCase().includes(q);
        const complaintMatch = (job.complaint || "").toLowerCase().includes(q);
        const diagMatch = (job.diagnosis || "").toLowerCase().includes(q);
        if (!numMatch && !brandMatch && !modelMatch && !imeiMatch && !complaintMatch && !diagMatch) {
          return false;
        }
      }
      return true;
    });
  }, [filteredJobsByDate, selectedTechId, searchQuery]);

  // Overall Shop Totals (Accurate distinct counting without double-counting)
  const shopMetrics = useMemo(() => {
    const totalDistinct = filteredJobsByDate.length;
    const completed = filteredJobsByDate.filter((j) => j.status === "completed").length;
    const inProgress = filteredJobsByDate.filter((j) => j.status === "in_progress").length;
    const pending = filteredJobsByDate.filter((j) => j.status === "received" || j.status === "open" || j.status === "assigned" || j.status === "waiting_for_parts" || j.status === "waiting_parts").length;
    const rework = filteredJobsByDate.filter((j) =>
      qcList.some((q) => q.job_card_id === j.id && !q.is_passed)
    ).length;
    const completionRate = totalDistinct > 0 ? Math.round((completed / totalDistinct) * 100) : 0;

    return { totalDistinct, completed, inProgress, pending, rework, completionRate };
  }, [filteredJobsByDate, qcList]);

  // Technician Specific Performance Comparisons
  const technicianComparison = useMemo(() => {
    // Collect all technicians: profiles with role === 'technician' or any staff having an assignment
    const techMap = new Map<string, Profile>();
    staffList.forEach((s) => {
      if (s.role === "technician" || s.role === "workshop_manager" || s.role === "owner") {
        techMap.set(s.id, s);
      }
    });

    // Also include anyone who has an assignment even if role is different
    jobs.forEach((j) => {
      j.assignments?.forEach((a) => {
        if (!techMap.has(a.technician_id)) {
          techMap.set(a.technician_id, {
            id: a.technician_id,
            full_name: a.technician_name || "Assigned Technician",
            role: "technician",
            is_active: true,
          });
        }
      });
    });

    return Array.from(techMap.values()).map((tech) => {
      const assignedJobs = filteredJobsByDate.filter((j) =>
        j.assignments?.some((a) => a.technician_id === tech.id)
      );
      const totalAssigned = assignedJobs.length;
      const completed = assignedJobs.filter((j) => j.status === "completed").length;
      const inProgress = assignedJobs.filter((j) => j.status === "in_progress").length;
      const pending = assignedJobs.filter((j) => j.status === "received" || j.status === "open" || j.status === "assigned" || j.status === "waiting_for_parts" || j.status === "waiting_parts").length;
      const rework = assignedJobs.filter((j) =>
        qcList.some((q) => q.job_card_id === j.id && !q.is_passed)
      ).length;
      const completionRate = totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0;
      const totalLabor = assignedJobs.reduce((sum, j) => {
        const myAssignment = j.assignments?.find((a) => a.technician_id === tech.id);
        return sum + Number(myAssignment?.labor_cost || 0);
      }, 0);

      return {
        ...tech,
        totalAssigned,
        completed,
        inProgress,
        pending,
        rework,
        completionRate,
        totalLabor,
      };
    }).sort((a, b) => b.completed - a.completed || b.totalAssigned - a.totalAssigned);
  }, [staffList, jobs, filteredJobsByDate, qcList]);

  // FIFO Inventory Financials
  const totalStockValuation = batches.reduce(
    (sum, b) => sum + Number(b.remaining_quantity || 0) * Number(b.unit_cost || 0),
    0
  );

  const issuedLedger = useMemo(() => {
    return ledger.filter((l) => l.movement_type === "issue");
  }, [ledger]);

  const totalPartsCostIssued = useMemo(() => {
    return issuedLedger.reduce(
      (sum, l) => sum + Math.abs(Number(l.quantity || 0)) * Number(l.unit_cost || 0),
      0
    );
  }, [issuedLedger]);

  // QC Yield
  const passedQcCount = qcList.filter((q) => q.is_passed).length;
  const failedQcCount = qcList.filter((q) => !q.is_passed).length;
  const qcYieldRate = qcList.length > 0 ? Math.round((passedQcCount / qcList.length) * 100) : 100;

  // Helper to get parts issued to a job
  function getPartsForJob(jobId: string) {
    return issuedLedger.filter((l) => l.job_card_id === jobId);
  }

  // Helper for technician name lookup
  function getTechName(id: string) {
    const p = staffList.find((s) => s.id === id);
    return p?.full_name || "Technician";
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">WORKSHOP ANALYTICS & AUDIT</div>
          <h1>Workshop Performance & Reports</h1>
          <p>
            Technician workload, repair velocity, FIFO parts consumption, inventory valuation, and quality control yield.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="secondary-btn" onClick={() => window.print()} title="Print or save as PDF">
            <Printer size={15} /> Print Report
          </button>
          <button className="secondary-btn" onClick={loadReportData} title="Refresh live database metrics">
            <RefreshCw size={15} /> Refresh Data
          </button>
        </div>
      </div>

      {/* Primary KPI Overview Cards (All in 1 Row) */}
      <div className="responsive-grid-5" style={{ gap: "12px", marginBottom: "20px" }}>
        <div className="stat-card">
          <div className="stat-icon Blue"><Wrench size={20} /></div>
          <div className="stat-label">Total Repair Jobs</div>
          <div className="stat-value" style={{ color: "#0176d3" }}>
            {shopMetrics.totalDistinct}
          </div>
          <div className="stat-foot">In selected period ({jobs.length} lifetime)</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon Green"><CheckCircle2 size={20} /></div>
          <div className="stat-label">Completed Repairs</div>
          <div className="stat-value" style={{ color: "#15945b" }}>
            {shopMetrics.completed}
          </div>
          <div className="stat-foot">{shopMetrics.completionRate}% completion rate</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon Orange"><Clock size={20} /></div>
          <div className="stat-label">Active / In Progress</div>
          <div className="stat-value" style={{ color: "#e68a2e" }}>
            {shopMetrics.inProgress}
          </div>
          <div className="stat-foot">{shopMetrics.pending} pending / waiting parts</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon Purple"><ShieldCheck size={20} /></div>
          <div className="stat-label">First-Time QC Yield</div>
          <div className="stat-value" style={{ color: "#7955c7" }}>
            {qcYieldRate}%
          </div>
          <div className="stat-foot">{passedQcCount} passed, {failedQcCount} rework audits</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon Blue"><Layers size={20} /></div>
          <div className="stat-label">FIFO Stock Valuation</div>
          <div className="stat-value">
            ₹{totalStockValuation.toLocaleString("en-IN")}
          </div>
          <div className="stat-foot">{parts.length} spare parts in warehouse</div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="tabs-nav" style={{ borderBottom: "1px solid #e0e7ef", marginBottom: "18px" }}>
        <button
          onClick={() => setActiveTab("technicians")}
          style={{
            padding: "10px 16px",
            border: "none",
            background: "none",
            borderBottom: activeTab === "technicians" ? "3px solid #0176d3" : "3px solid transparent",
            color: activeTab === "technicians" ? "#0176d3" : "#687b92",
            fontWeight: activeTab === "technicians" ? 700 : 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
          }}
        >
          <Users size={16} />
          <span className="desktop-tab-label">Technician Performance Tracking</span>
          <span className="mobile-tab-label">Technicians</span>
        </button>

        <button
          onClick={() => setActiveTab("operations")}
          style={{
            padding: "10px 16px",
            border: "none",
            background: "none",
            borderBottom: activeTab === "operations" ? "3px solid #0176d3" : "3px solid transparent",
            color: activeTab === "operations" ? "#0176d3" : "#687b92",
            fontWeight: activeTab === "operations" ? 700 : 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
          }}
        >
          <Wrench size={16} />
          <span className="desktop-tab-label">Repair Operations & Pipeline</span>
          <span className="mobile-tab-label">Operations</span>
        </button>

        <button
          onClick={() => setActiveTab("inventory")}
          style={{
            padding: "10px 16px",
            border: "none",
            background: "none",
            borderBottom: activeTab === "inventory" ? "3px solid #0176d3" : "3px solid transparent",
            color: activeTab === "inventory" ? "#0176d3" : "#687b92",
            fontWeight: activeTab === "inventory" ? 700 : 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
          }}
        >
          <Layers size={16} />
          <span className="desktop-tab-label">Spare Parts FIFO & Consumption</span>
          <span className="mobile-tab-label">Spare Parts</span>
        </button>

        <button
          onClick={() => setActiveTab("qc")}
          style={{
            padding: "10px 16px",
            border: "none",
            background: "none",
            borderBottom: activeTab === "qc" ? "3px solid #0176d3" : "3px solid transparent",
            color: activeTab === "qc" ? "#0176d3" : "#687b92",
            fontWeight: activeTab === "qc" ? 700 : 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
          }}
        >
          <ShieldCheck size={16} />
          <span className="desktop-tab-label">Quality Control & Rework Audit</span>
          <span className="mobile-tab-label">QC Audit</span>
        </button>

        <button
          onClick={() => setActiveTab("accessories")}
          style={{
            padding: "10px 16px",
            border: "none",
            background: "none",
            borderBottom: activeTab === "accessories" ? "3px solid #0176d3" : "3px solid transparent",
            color: activeTab === "accessories" ? "#0176d3" : "#687b92",
            fontWeight: activeTab === "accessories" ? 700 : 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
          }}
        >
          <Headphones size={16} />
          <span className="desktop-tab-label">Accessories & Merchandise</span>
          <span className="mobile-tab-label">Accessories</span>
        </button>
      </div>

      {/* FILTER CONTROLS BAR (Applies to all tabs) */}
      <div
        className="panel"
        style={{
          padding: "14px 18px",
          marginBottom: "18px",
          background: "#fff",
          borderRadius: "8px",
          border: "1px solid #e0e7ef",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "center", justifyContent: "space-between" }}>
          {/* Date Range Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#687b92", textTransform: "uppercase" }}>
              <Calendar size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
              Period:
            </span>
            {(["all", "today", "week", "month", "custom"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDateRange(r)}
                style={{
                  padding: "5px 10px",
                  fontSize: "11px",
                  fontWeight: 600,
                  borderRadius: "5px",
                  border: "1px solid",
                  cursor: "pointer",
                  borderColor: dateRange === r ? "#0176d3" : "#e0e7ef",
                  background: dateRange === r ? "#e8f2fc" : "#fff",
                  color: dateRange === r ? "#0176d3" : "#4a5568",
                }}
              >
                <span className="desktop-tab-label">
                  {r === "all" ? "All Time" : r === "today" ? "Today" : r === "week" ? "Last 7 Days" : r === "month" ? "Last 30 Days" : "Custom Range"}
                </span>
                <span className="mobile-tab-label">
                  {r === "all" ? "All" : r === "today" ? "Today" : r === "week" ? "7D" : r === "month" ? "30D" : "Custom"}
                </span>
              </button>
            ))}

            {dateRange === "custom" && (
              <div style={{ display: "flex", gap: "6px", alignItems: "center", marginLeft: "6px" }}>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  style={{ fontSize: "11px", padding: "4px 8px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                />
                <span style={{ fontSize: "11px", color: "#64748b" }}>to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  style={{ fontSize: "11px", padding: "4px 8px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                />
              </div>
            )}
          </div>

          {/* Technician & Search Filters */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", width: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#687b92", textTransform: "uppercase" }}>
                <Users size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
                Technician:
              </span>
              <CustomSelect
                value={selectedTechId}
                onChange={(val) => setSelectedTechId(val)}
                minWidth="175px"
                height="32px"
                triggerStyle={{
                  height: "32px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  padding: "0 8px 0 10px",
                }}
                options={[
                  { value: "all", label: `All Technicians (${technicianComparison.length})` },
                  ...technicianComparison.map((t) => ({
                    value: t.id,
                    label: `${t.full_name} (${t.completed}/${t.totalAssigned})`,
                  })),
                ]}
              />
            </div>

            <div style={{ position: "relative", flex: 1, minWidth: "160px" }}>
              <Search size={14} style={{ position: "absolute", left: "9px", top: "8px", color: "#94a3b8" }} />
              <input
                type="text"
                placeholder="Search job #, handset, IMEI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: "5px 10px 5px 28px",
                  fontSize: "11px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "5px",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: TECHNICIAN PERFORMANCE TRACKING */}
      {/* ========================================================================= */}
      {activeTab === "technicians" && (
        <div style={{ display: "grid", gap: "20px" }}>
          {/* Multi-Technician Attribution Explanatory Notice */}
          <div
            style={{
              padding: "10px 14px",
              background: "#f0f7ff",
              border: "1px solid #c9e0fa",
              borderRadius: "6px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "11px",
              color: "#1e40af",
            }}
          >
            <span>
              <b>Accurate Attribution Notice:</b> Shop totals count distinct repair jobs ({shopMetrics.totalDistinct} total). When multiple technicians collaborate on a single handset, each technician receives full individual credit for their assigned repair task without double-counting shop repairs.
            </span>
            {selectedTechId !== "all" && (
              <button
                onClick={() => setSelectedTechId("all")}
                style={{
                  background: "#fff",
                  border: "1px solid #0176d3",
                  color: "#0176d3",
                  fontSize: "10px",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Clear Tech Filter
              </button>
            )}
          </div>

          {/* Technician Comparison Matrix */}
          <section className="panel">
            <div className="section-head">
              <div>
                <h2>Technician Performance Comparison</h2>
                <p>Repairs assigned, completed, in-progress, rework required, and completion velocity</p>
              </div>
              <Users size={18} className="muted" />
            </div>

            <div className="table-wrap desktop-reports-table" style={{ marginTop: "12px" }}>
              <table>
                <thead>
                  <tr>
                    <th>Technician</th>
                    <th>Assigned Repairs</th>
                    <th>Completed</th>
                    <th>In Progress</th>
                    <th>Pending</th>
                    <th>QC Rework</th>
                    <th>Completion %</th>
                    <th>Labor Earned</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {technicianComparison.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", color: "#64748b", padding: "24px" }}>
                        No technicians found. Assign technicians to job cards to view workload metrics.
                      </td>
                    </tr>
                  ) : (
                    technicianComparison.map((tech) => {
                      const isSelected = selectedTechId === tech.id;
                      return (
                        <tr
                          key={tech.id}
                          style={{
                            background: isSelected ? "#f0f7ff" : "inherit",
                            fontWeight: isSelected ? 600 : "normal",
                          }}
                        >
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div
                                style={{
                                  width: "28px",
                                  height: "28px",
                                  borderRadius: "50%",
                                  background: "#e0e7ef",
                                  color: "#0176d3",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "11px",
                                  fontWeight: 800,
                                }}
                              >
                                {tech.full_name?.charAt(0) || "T"}
                              </div>
                              <div>
                                <b style={{ color: "#152b49" }}>{tech.full_name}</b>
                                <div style={{ fontSize: "10px", color: "#64748b", textTransform: "capitalize" }}>
                                  {tech.role?.replace(/_/g, " ")}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: "13px", fontWeight: 700 }}>{tech.totalAssigned}</span>
                          </td>
                          <td>
                            <span className="tag" style={{ background: "#e8f8f0", color: "#15945b", fontWeight: 700 }}>
                              {tech.completed}
                            </span>
                          </td>
                          <td>
                            <span className="tag" style={{ background: "#fff5eb", color: "#e68a2e", fontWeight: 700 }}>
                              {tech.inProgress}
                            </span>
                          </td>
                          <td>
                            <span className="tag" style={{ background: "#f1f5f9", color: "#475569", fontWeight: 600 }}>
                              {tech.pending}
                            </span>
                          </td>
                          <td>
                            <span
                              className="tag"
                              style={{
                                background: tech.rework > 0 ? "#fef2f2" : "#f8fafc",
                                color: tech.rework > 0 ? "#b42318" : "#94a3b8",
                                fontWeight: 700,
                              }}
                            >
                              {tech.rework}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "120px" }}>
                              <div style={{ flex: 1, background: "#e2e8f0", height: "6px", borderRadius: "3px", overflow: "hidden" }}>
                                <div
                                  style={{
                                    width: `${tech.completionRate}%`,
                                    background: tech.completionRate >= 80 ? "#15945b" : tech.completionRate >= 50 ? "#0176d3" : "#e68a2e",
                                    height: "100%",
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: "11px", fontWeight: 700, minWidth: "32px" }}>
                                {tech.completionRate}%
                              </span>
                            </div>
                          </td>
                          <td>
                            <b>₹{tech.totalLabor.toLocaleString("en-IN")}</b>
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => setSelectedTechId(isSelected ? "all" : tech.id)}
                              style={{
                                padding: "4px 8px",
                                fontSize: "10px",
                                fontWeight: 600,
                                borderRadius: "4px",
                                border: isSelected ? "1px solid #0176d3" : "1px solid #cbd5e1",
                                background: isSelected ? "#0176d3" : "#fff",
                                color: isSelected ? "#fff" : "#1e293b",
                                cursor: "pointer",
                              }}
                            >
                              {isSelected ? "Showing" : "Filter History"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch Cards for Technician Comparison */}
            <div className="mobile-reports-tech-cards">
              {technicianComparison.length === 0 ? (
                <div style={{ textAlign: "center", color: "#64748b", padding: "20px" }}>
                  No technicians found. Assign technicians to job cards to view workload metrics.
                </div>
              ) : (
                technicianComparison.map((tech) => {
                  const isSelected = selectedTechId === tech.id;
                  return (
                    <div
                      key={tech.id}
                      className="mobile-reports-tech-card"
                      style={{
                        borderColor: isSelected ? "#0176d3" : "#e2e8f0",
                        background: isSelected ? "#f0f7ff" : "#ffffff",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              background: "#e0e7ef",
                              color: "#0176d3",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "12px",
                              fontWeight: 800,
                            }}
                          >
                            {tech.full_name?.charAt(0) || "T"}
                          </div>
                          <div>
                            <b style={{ color: "#152b49", fontSize: "13px" }}>{tech.full_name}</b>
                            <div style={{ fontSize: "10.5px", color: "#64748b", textTransform: "capitalize" }}>
                              {tech.role?.replace(/_/g, " ")}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedTechId(isSelected ? "all" : tech.id)}
                          style={{
                            padding: "5px 10px",
                            fontSize: "11px",
                            fontWeight: 600,
                            borderRadius: "6px",
                            border: isSelected ? "1px solid #0176d3" : "1px solid #cbd5e1",
                            background: isSelected ? "#0176d3" : "#fff",
                            color: isSelected ? "#fff" : "#1e293b",
                            cursor: "pointer",
                          }}
                        >
                          {isSelected ? "Filtered ✓" : "Filter"}
                        </button>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", textAlign: "center", background: "#f8fafc", padding: "8px", borderRadius: "8px" }}>
                        <div>
                          <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase" }}>Assigned</div>
                          <b style={{ fontSize: "13px", color: "#1e293b" }}>{tech.totalAssigned}</b>
                        </div>
                        <div>
                          <div style={{ fontSize: "10px", color: "#15945b", textTransform: "uppercase" }}>Done</div>
                          <b style={{ fontSize: "13px", color: "#15945b" }}>{tech.completed}</b>
                        </div>
                        <div>
                          <div style={{ fontSize: "10px", color: "#e68a2e", textTransform: "uppercase" }}>Active</div>
                          <b style={{ fontSize: "13px", color: "#e68a2e" }}>{tech.inProgress}</b>
                        </div>
                        <div>
                          <div style={{ fontSize: "10px", color: "#b42318", textTransform: "uppercase" }}>Rework</div>
                          <b style={{ fontSize: "13px", color: "#b42318" }}>{tech.rework}</b>
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, marginRight: "12px" }}>
                          <div style={{ flex: 1, background: "#e2e8f0", height: "6px", borderRadius: "3px", overflow: "hidden" }}>
                            <div
                              style={{
                                width: `${tech.completionRate}%`,
                                background: tech.completionRate >= 80 ? "#15945b" : tech.completionRate >= 50 ? "#0176d3" : "#e68a2e",
                                height: "100%",
                              }}
                            />
                          </div>
                          <span style={{ fontSize: "11px", fontWeight: 700 }}>{tech.completionRate}%</span>
                        </div>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#152b49" }}>
                          ₹{tech.totalLabor.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Individual Technician Repair History Table */}
          <section className="panel">
            <div className="section-head">
              <div>
                <h2>
                  Individual Repair Job History & Spare Parts Consumed
                  {selectedTechId !== "all" && ` — Filtered by ${getTechName(selectedTechId)}`}
                </h2>
                <p>Complete repair audit showing handset, assigned technicians, repair status, and FIFO parts consumed</p>
              </div>
              <span className="tag" style={{ background: "#e8f2fc", color: "#0176d3", fontWeight: 700 }}>
                {visibleJobs.length} Jobs Listed
              </span>
            </div>

            <div className="table-wrap desktop-reports-table" style={{ marginTop: "12px" }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ minWidth: "90px" }}>Job #</th>
                    <th style={{ minWidth: "160px" }}>Handset & IMEI</th>
                    <th style={{ minWidth: "200px" }}>Reported Problem / Diagnosis</th>
                    <th style={{ minWidth: "260px" }}>Assigned Technicians & Tasks</th>
                    <th style={{ minWidth: "110px" }}>Assigned Date</th>
                    <th style={{ minWidth: "120px" }}>Completion Date</th>
                    <th style={{ minWidth: "110px" }}>Status</th>
                    <th style={{ minWidth: "180px" }}>Spare Parts Used (FIFO)</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleJobs.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", color: "#64748b", padding: "30px" }}>
                        No repair jobs found matching the active filter criteria.
                      </td>
                    </tr>
                  ) : (
                    visibleJobs.map((job) => {
                      const jobParts = getPartsForJob(job.id);
                      const totalJobPartsCost = jobParts.reduce(
                        (sum, p) => sum + Math.abs(Number(p.quantity || 0)) * Number(p.unit_cost || 0),
                        0
                      );

                      return (
                        <tr key={job.id}>
                          <td style={{ verticalAlign: "top", whiteSpace: "nowrap" }}>
                            <b style={{ color: "#0176d3" }}>#{job.job_number || job.id.slice(0, 8)}</b>
                            <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                              {job.priority} Priority
                            </div>
                          </td>
                          <td style={{ verticalAlign: "top", whiteSpace: "normal", minWidth: "160px" }}>
                            <b style={{ color: "#152b49" }}>
                              {job.device?.brand} {job.device?.model}
                            </b>
                            <div style={{ fontSize: "10px", color: "#64748b" }}>
                              IMEI: {job.device?.imei || job.device?.imei1 || "N/A"}
                            </div>
                          </td>
                          <td style={{ verticalAlign: "top", whiteSpace: "normal", minWidth: "200px", maxWidth: "240px" }}>
                            <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "12px", lineHeight: "1.4" }}>
                              {job.complaint || job.title}
                            </div>
                            {job.diagnosis && (
                              <div style={{ fontSize: "10px", color: "#0176d3", marginTop: "3px", lineHeight: "1.3" }}>
                                <b>Diagnosis:</b> {job.diagnosis}
                              </div>
                            )}
                          </td>
                          <td style={{ verticalAlign: "top", minWidth: "260px", maxWidth: "340px", whiteSpace: "normal" }}>
                            {job.assignments && job.assignments.length > 0 ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                {job.assignments.map((a) => {
                                  const techName = getTechName(a.technician_id);
                                  const isSelected = a.technician_id === selectedTechId;

                                  // Parse specialization and clean task name if formatted as "[Spec] Task"
                                  let spec = "";
                                  let cleanTask = (a.task_name || "Repair task").trim();
                                  const specMatch = cleanTask.match(/^\[(.*?)\]\s*(.*)$/);
                                  if (specMatch) {
                                    spec = specMatch[1];
                                    cleanTask = specMatch[2] || specMatch[1];
                                  }

                                  return (
                                    <div
                                      key={a.id}
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "4px",
                                        padding: "6px 9px",
                                        background: isSelected ? "#eff6ff" : "#f8fafc",
                                        border: isSelected ? "1px solid #93c5fd" : "1px solid #e2e8f0",
                                        borderRadius: "6px",
                                        fontSize: "11px",
                                        lineHeight: "1.4",
                                        wordBreak: "break-word",
                                        overflowWrap: "anywhere",
                                      }}
                                    >
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", flexWrap: "wrap" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                          <span
                                            style={{
                                              display: "inline-flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              width: "18px",
                                              height: "18px",
                                              borderRadius: "50%",
                                              background: isSelected ? "#2563eb" : "#cbd5e1",
                                              color: isSelected ? "#ffffff" : "#1e293b",
                                              fontSize: "10px",
                                              fontWeight: 700,
                                              flexShrink: 0,
                                            }}
                                          >
                                            {techName.charAt(0).toUpperCase()}
                                          </span>
                                          <span style={{ fontWeight: 600, color: "#1e293b" }}>{techName}</span>
                                        </div>
                                        {spec && (
                                          <span
                                            style={{
                                              fontSize: "9px",
                                              fontWeight: 600,
                                              padding: "1px 6px",
                                              borderRadius: "4px",
                                              background: "#e0f2fe",
                                              color: "#0369a1",
                                              whiteSpace: "nowrap",
                                            }}
                                          >
                                            {spec}
                                          </span>
                                        )}
                                      </div>

                                      <div style={{ display: "flex", alignItems: "flex-start", gap: "4px", color: "#475569", fontSize: "11px", paddingLeft: "2px" }}>
                                        <span style={{ color: "#94a3b8", fontSize: "11px", marginTop: "1px" }}>↳</span>
                                        <span style={{ fontWeight: 500 }}>{cleanTask}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td style={{ verticalAlign: "top", fontSize: "11px", color: "#475569", whiteSpace: "nowrap" }}>
                            {job.created_at ? new Date(job.created_at).toLocaleDateString() : "—"}
                          </td>
                          <td style={{ verticalAlign: "top", fontSize: "11px", color: "#475569", whiteSpace: "nowrap" }}>
                            {job.status === "completed" && job.completed_at ? (
                              <span style={{ color: "#15945b", fontWeight: 600 }}>
                                {new Date(job.completed_at).toLocaleDateString()}
                              </span>
                            ) : job.status === "completed" ? (
                              <span style={{ color: "#15945b", fontWeight: 600 }}>Completed</span>
                            ) : (
                              <span style={{ color: "#e68a2e", fontStyle: "italic" }}>In Progress</span>
                            )}
                          </td>
                          <td style={{ verticalAlign: "top", whiteSpace: "nowrap" }}>
                            <span
                              className="tag"
                              style={{
                                background:
                                  job.status === "completed"
                                    ? "#e8f8f0"
                                    : job.status === "in_progress"
                                    ? "#fff5eb"
                                    : job.status === "waiting_parts"
                                    ? "#fef2f2"
                                    : "#f1f5f9",
                                color:
                                  job.status === "completed"
                                    ? "#15945b"
                                    : job.status === "in_progress"
                                    ? "#e68a2e"
                                    : job.status === "waiting_parts"
                                    ? "#b42318"
                                    : "#475569",
                                fontWeight: 700,
                              }}
                            >
                              {job.status?.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td style={{ verticalAlign: "top", whiteSpace: "normal", minWidth: "170px" }}>
                            {jobParts.length > 0 ? (
                              <div style={{ display: "grid", gap: "3px" }}>
                                {jobParts.map((p) => (
                                  <div
                                    key={p.id}
                                    style={{
                                      fontSize: "10px",
                                      background: "#f8fafc",
                                      padding: "2px 6px",
                                      borderRadius: "3px",
                                      border: "1px solid #e2e8f0",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      gap: "8px",
                                    }}
                                  >
                                    <span>
                                      <b>{p.part_name || p.sku}</b> × {Math.abs(p.quantity)}
                                    </span>
                                    <span style={{ color: "#0176d3", fontWeight: 600 }}>
                                      ₹{(Math.abs(p.quantity) * p.unit_cost).toLocaleString("en-IN")}
                                    </span>
                                  </div>
                                ))}
                                <div style={{ fontSize: "10px", fontWeight: 700, color: "#152b49", textAlign: "right" }}>
                                  Total: ₹{totalJobPartsCost.toLocaleString("en-IN")}
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontSize: "10px", color: "#94a3b8", fontStyle: "italic" }}>
                                None (Labor only)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch Cards for Repair Jobs Audit */}
            <div className="mobile-reports-jobs-cards">
              {visibleJobs.length === 0 ? (
                <div style={{ textAlign: "center", color: "#64748b", padding: "20px" }}>
                  No repair jobs found matching the active filter criteria.
                </div>
              ) : (
                visibleJobs.map((job) => {
                  const jobParts = getPartsForJob(job.id);
                  const totalJobPartsCost = jobParts.reduce(
                    (sum, p) => sum + Math.abs(Number(p.quantity || 0)) * Number(p.unit_cost || 0),
                    0
                  );

                  return (
                    <div key={job.id} className="mobile-reports-job-card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <b style={{ color: "#0176d3", fontSize: "13px" }}>
                            #{job.job_number || job.id.slice(0, 8)}
                          </b>
                          <div style={{ fontSize: "10.5px", color: "#94a3b8" }}>
                            {job.priority} Priority
                          </div>
                        </div>
                        <span
                          className="tag"
                          style={{
                            background:
                              job.status === "completed"
                                ? "#e8f8f0"
                                : job.status === "in_progress"
                                ? "#fff5eb"
                                : job.status === "waiting_parts"
                                ? "#fef2f2"
                                : "#f1f5f9",
                            color:
                              job.status === "completed"
                                ? "#15945b"
                                : job.status === "in_progress"
                                ? "#e68a2e"
                                : job.status === "waiting_parts"
                                ? "#b42318"
                                : "#475569",
                            fontWeight: 700,
                          }}
                        >
                          {job.status?.replace(/_/g, " ")}
                        </span>
                      </div>

                      <div>
                        <b style={{ color: "#152b49", fontSize: "13px" }}>
                          {job.device?.brand} {job.device?.model}
                        </b>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>
                          IMEI: {job.device?.imei || job.device?.imei1 || "N/A"}
                        </div>
                      </div>

                      <div style={{ background: "#f8fafc", padding: "8px 10px", borderRadius: "6px", fontSize: "11.5px" }}>
                        <div style={{ fontWeight: 600, color: "#1e293b" }}>{job.complaint || job.title}</div>
                        {job.diagnosis && (
                          <div style={{ fontSize: "10.5px", color: "#0176d3", marginTop: "3px" }}>
                            <b>Diag:</b> {job.diagnosis}
                          </div>
                        )}
                      </div>

                      {/* Technicians */}
                      {job.assignments && job.assignments.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          {job.assignments.map((a) => (
                            <span key={a.technician_id} className="tag" style={{ background: "#edf5fc", color: "#0176d3", fontSize: "10.5px" }}>
                              {getTechName(a.technician_id)}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* FIFO Parts */}
                      {jobParts.length > 0 && (
                        <div style={{ fontSize: "11px", color: "#475569", background: "#f1f5f9", padding: "6px 8px", borderRadius: "4px" }}>
                          <b>Parts:</b> {jobParts.map((p) => `${p.part_name || p.sku} (×${Math.abs(p.quantity)})`).join(", ")}
                          <div style={{ color: "#0176d3", fontWeight: 700, marginTop: "2px" }}>
                            Parts Total: ₹{totalJobPartsCost.toLocaleString("en-IN")}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: REPAIR OPERATIONS & WORKLOAD PIPELINE */}
      {/* ========================================================================= */}
      {activeTab === "operations" && (
        <div style={{ display: "grid", gap: "20px" }}>
          <div className="dashboard-grid">
          {/* Workshop Stage Breakdown */}
          <section className="panel">
            <div className="section-head">
              <div>
                <h2>Workshop Handset Pipeline Breakdown</h2>
                <p>Current distribution of handsets across repair stages</p>
              </div>
              <Smartphone size={19} className="muted" />
            </div>

            <div style={{ display: "grid", gap: "12px", marginTop: "14px" }}>
              {[
                { stage: "Received (Intake Pending)", count: devices.filter((d) => normalizeDeviceStatus(d.status) === "received").length, color: "#0176d3" },
                { stage: "Under Active Repair Bench", count: devices.filter((d) => { const s = normalizeDeviceStatus(d.status); return s === "in_repair" || s === "repair"; }).length, color: "#e68a2e" },
                { stage: "Repaired & Ready for Handover", count: devices.filter((d) => normalizeDeviceStatus(d.status) === "ready_for_sale").length, color: "#15945b" },
                { stage: "Scrapped / Unrepairable", count: devices.filter((d) => normalizeDeviceStatus(d.status) === "scrapped").length, color: "#b42318" },
              ].map((item) => (
                <div key={item.stage} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", background: "#f8fafc", borderRadius: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#152b49" }}>{item.stage}</span>
                  <span className="tag" style={{ background: "#fff", border: "1px solid #e2e8f0", fontWeight: 800, color: item.color, fontSize: "12px" }}>
                    {item.count} handsets
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Job Priority & Workload Distribution */}
          <section className="panel">
            <div className="section-head">
              <div>
                <h2>Repair Priority & Workload Distribution</h2>
                <p>Breakdown of active jobs by workshop urgency</p>
              </div>
              <Activity size={19} className="muted" />
            </div>

            <div style={{ display: "grid", gap: "12px", marginTop: "14px" }}>
              {[
                { priority: "Urgent", count: jobs.filter((j) => (j.priority?.toLowerCase() === "urgent") && j.status !== "completed").length, color: "#b42318", bg: "#fef2f2" },
                { priority: "High", count: jobs.filter((j) => (j.priority?.toLowerCase() === "high") && j.status !== "completed").length, color: "#e68a2e", bg: "#fff5eb" },
                { priority: "Normal", count: jobs.filter((j) => (j.priority?.toLowerCase() === "normal" || !j.priority) && j.status !== "completed").length, color: "#0176d3", bg: "#e8f2fc" },
                { priority: "Low", count: jobs.filter((j) => (j.priority?.toLowerCase() === "low") && j.status !== "completed").length, color: "#64748b", bg: "#f1f5f9" },
              ].map((item) => (
                <div key={item.priority} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", background: "#f8fafc", borderRadius: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#152b49" }}>{item.priority} Priority Jobs</span>
                  <span className="tag" style={{ background: item.bg, border: `1px solid ${item.color}`, fontWeight: 800, color: item.color, fontSize: "12px" }}>
                    {item.count} pending
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Problem-Wise Repair Statistics */}
        <section className="panel" style={{ marginTop: "20px" }}>
          <div className="section-head">
            <div>
              <h2>Problem-Wise Repair Statistics</h2>
              <p>Volume, diagnosis classification, and resolution rates by problem category</p>
            </div>
            <Wrench size={19} className="muted" />
          </div>

          <div className="table-wrap" style={{ marginTop: "12px" }}>
            <table>
              <thead>
                <tr>
                  <th>Problem Category</th>
                  <th>Reported Repairs</th>
                  <th>Successfully Solved</th>
                  <th>In-Progress / Pending</th>
                  <th>QC Reworks</th>
                  <th>Resolution Rate</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { cat: "Screen & Display Issues", keywords: ["screen", "display", "glass", "touch", "lcd", "amoled", "flicker"] },
                  { cat: "Motherboard & IC Faults", keywords: ["motherboard", "board", "ic", "short", "dead", "power", "water", "liquid"] },
                  { cat: "Battery & Power Backup", keywords: ["battery", "drain", "backup", "overheat", "swollen"] },
                  { cat: "Charging Jack & Port", keywords: ["charg", "port", "pin", "jack", "type-c", "lightning", "slow charging"] },
                  { cat: "Camera & Optical Sensors", keywords: ["camera", "lens", "blur", "focus", "glass"] },
                  { cat: "Audio (Speaker / Mic / Earpiece)", keywords: ["speaker", "mic", "microphone", "audio", "sound", "ringer", "earpiece"] },
                  { cat: "Software, Bootloop & OS", keywords: ["software", "bootloop", "hang", "logo", "frp", "lock", "update", "flash"] },
                  { cat: "Network, WiFi & SIM", keywords: ["network", "wifi", "sim", "signal", "antenna", "bluetooth"] },
                  { cat: "General Hardware & Body", keywords: ["body", "housing", "frame", "button", "vibrator"] },
                ].map((group) => {
                  const matchedJobs = filteredJobsByDate.filter((j) => {
                    const text = `${j.complaint || ""} ${j.diagnosis || ""}`.toLowerCase();
                    return group.keywords.some((k) => text.includes(k));
                  });
                  const total = matchedJobs.length;
                  const solved = matchedJobs.filter((j) => j.status === "completed").length;
                  const pending = matchedJobs.filter((j) => j.status !== "completed").length;
                  const rework = matchedJobs.filter((j) => qcList.some((q) => q.job_card_id === j.id && !q.is_passed)).length;
                  const rate = total > 0 ? Math.round((solved / total) * 100) : 0;

                  return (
                    <tr key={group.cat}>
                      <td><b>{group.cat}</b></td>
                      <td><b style={{ color: "#0176d3" }}>{total}</b></td>
                      <td><span style={{ color: "#15945b", fontWeight: 700 }}>{solved}</span></td>
                      <td><span style={{ color: "#d97706", fontWeight: 600 }}>{pending}</span></td>
                      <td><span style={{ color: rework > 0 ? "#b42318" : "#64748b", fontWeight: 600 }}>{rework}</span></td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ flex: 1, height: "6px", background: "#f1f5f9", borderRadius: "3px", overflow: "hidden", minWidth: "60px" }}>
                            <div style={{ width: `${rate}%`, height: "100%", background: rate >= 75 ? "#10b981" : "#0176d3" }} />
                          </div>
                          <span style={{ fontSize: "11px", fontWeight: 700, minWidth: "35px" }}>{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Phone-Wise Repair Cost Breakdown */}
        <section className="panel" style={{ marginTop: "20px" }}>
          <div className="section-head">
            <div>
              <h2>Phone-Wise Repair Cost Breakdown</h2>
              <p>Granular cost audit: parts cost, labor cost, and total repair expenses per smartphone</p>
            </div>
            <DollarSign size={19} className="muted" />
          </div>

          <div className="table-wrap" style={{ marginTop: "12px" }}>
            <table>
              <thead>
                <tr>
                  <th>Job Card #</th>
                  <th>Handset (Brand & Model)</th>
                  <th>IMEI</th>
                  <th>Reported Problem</th>
                  <th>Parts Cost (₹)</th>
                  <th>Labor Cost (₹)</th>
                  <th>Total Repair Cost (₹)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobsByDate.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", color: "#64748b", padding: "24px" }}>
                      No repair jobs recorded for this period.
                    </td>
                  </tr>
                ) : (
                  filteredJobsByDate.map((job) => {
                    const partsCost = Number(job.parts_cost || 0);
                    const totalCost = Number(job.total_repair_cost || (job as any).final_cost || partsCost);
                    const laborCost = Number((job as any).labor_cost || job.actual_labor_cost || Math.max(0, totalCost - partsCost));

                    return (
                      <tr key={job.id}>
                        <td>
                          <b style={{ color: "#0176d3", fontFamily: "monospace" }}>
                            {job.job_number || `JOB-${job.id.slice(0, 6).toUpperCase()}`}
                          </b>
                        </td>
                        <td>
                          <b>{job.device ? `${job.device.brand} ${job.device.model}` : "Unknown Device"}</b>
                        </td>
                        <td>
                          <span style={{ fontFamily: "monospace", fontSize: "10px", color: "#64748b" }}>
                            {job.device?.imei || job.device?.imei1 || "N/A"}
                          </span>
                        </td>
                        <td style={{ maxWidth: "200px" }}>
                          <span style={{ fontSize: "11px", color: "#475569" }}>
                            {job.complaint || job.diagnosis || "Diagnosis & Repair"}
                          </span>
                        </td>
                        <td>
                          <b style={{ color: "#e68a2e" }}>₹{partsCost.toFixed(2)}</b>
                        </td>
                        <td>
                          <b style={{ color: "#0176d3" }}>₹{laborCost.toFixed(2)}</b>
                        </td>
                        <td>
                          <b style={{ color: "#15945b", fontSize: "12px" }}>₹{totalCost.toFixed(2)}</b>
                        </td>
                        <td>
                          <span
                            className="tag"
                            style={{
                              fontSize: "10px",
                              fontWeight: 600,
                              background: job.status === "completed" ? "#e8f8f0" : "#f1f5f9",
                              color: job.status === "completed" ? "#15803d" : "#475569",
                            }}
                          >
                            {job.status.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SPARE PARTS FIFO & CONSUMPTION */}
      {/* ========================================================================= */}
      {activeTab === "inventory" && (
        <div style={{ display: "grid", gap: "20px" }}>
          {/* Inventory Summary Stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon Blue"><Layers size={20} /></div>
              <div className="stat-label">Total Warehouse Valuation</div>
              <div className="stat-value" style={{ color: "#0176d3" }}>
                ₹{totalStockValuation.toLocaleString("en-IN")}
              </div>
              <div className="stat-foot">Across {batches.length} FIFO batches</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon Orange"><Wrench size={20} /></div>
              <div className="stat-label">Spare Parts Consumed in Repairs</div>
              <div className="stat-value" style={{ color: "#e68a2e" }}>
                ₹{totalPartsCostIssued.toLocaleString("en-IN")}
              </div>
              <div className="stat-foot">{issuedLedger.length} FIFO issuance transactions</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon Green"><Package size={20} /></div>
              <div className="stat-label">Active Spare Part SKUs</div>
              <div className="stat-value">{parts.length}</div>
              <div className="stat-foot">Catalogued SKUs in inventory</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon Red"><AlertTriangle size={20} /></div>
              <div className="stat-label">Low Stock Alerts</div>
              <div className="stat-value" style={{ color: "#b42318" }}>
                {parts.filter((p) => Number(p.quantity || 0) <= Number(p.reorder_level || 5)).length}
              </div>
              <div className="stat-foot">SKUs at or below reorder threshold</div>
            </div>
          </div>

          {/* Parts Consumption Breakdown Table */}
          <section className="panel">
            <div className="section-head">
              <div>
                <h2>Spare Parts Valuation & Consumption Analysis</h2>
                <p>Stock on hand, FIFO batch valuation, and repair consumption quantities</p>
              </div>
              <Layers size={19} className="muted" />
            </div>

            <div className="table-wrap desktop-reports-table" style={{ marginTop: "12px" }}>
              <table>
                <thead>
                  <tr>
                    <th>Part SKU & Name</th>
                    <th>Current Stock</th>
                    <th>Reorder Level</th>
                    <th>Total Consumed in Repairs</th>
                    <th>Consumed Valuation</th>
                    <th>Current Warehouse Valuation</th>
                    <th>Stock Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((p) => {
                    const partBatches = batches.filter((b) => b.spare_part_id === p.id);
                    const batchVal = partBatches.reduce(
                      (sum, b) => sum + Number(b.remaining_quantity || 0) * Number(b.unit_cost || 0),
                      0
                    );
                    const partIssues = issuedLedger.filter((l) => l.spare_part_id === p.id);
                    const totalConsumedQty = partIssues.reduce((sum, l) => sum + Math.abs(Number(l.quantity || 0)), 0);
                    const totalConsumedCost = partIssues.reduce(
                      (sum, l) => sum + Math.abs(Number(l.quantity || 0)) * Number(l.unit_cost || 0),
                      0
                    );
                    const isLow = Number(p.quantity || 0) <= Number(p.reorder_level || 5);

                    return (
                      <tr key={p.id}>
                        <td>
                          <b>{p.name}</b>
                          <div style={{ fontSize: "10px", color: "#8291a5" }}>SKU: {p.sku}</div>
                          {p.compatible_models && (
                            <div style={{ fontSize: "10px", color: "#64748b" }}>Models: {p.compatible_models}</div>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: isLow ? "#b42318" : "#152b49" }}>
                            {p.quantity} units
                          </span>
                        </td>
                        <td style={{ fontSize: "11px", color: "#64748b" }}>{p.reorder_level} units</td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{totalConsumedQty} units</span>
                        </td>
                        <td>
                          <b>₹{totalConsumedCost.toLocaleString("en-IN")}</b>
                        </td>
                        <td>
                          <b>₹{batchVal.toLocaleString("en-IN")}</b>
                        </td>
                        <td>
                          {isLow ? (
                            <span className="tag" style={{ background: "#fef2f2", color: "#b42318", fontWeight: 700 }}>
                              Reorder Alert
                            </span>
                          ) : (
                            <span className="tag" style={{ background: "#e8f8f0", color: "#15945b", fontWeight: 600 }}>
                              Optimal
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: QUALITY CONTROL & REWORK AUDIT */}
      {/* ========================================================================= */}
      {activeTab === "qc" && (
        <div style={{ display: "grid", gap: "20px" }}>
          {/* QC Stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon Blue"><ShieldCheck size={20} /></div>
              <div className="stat-label">Total QC Inspections</div>
              <div className="stat-value">{qcList.length}</div>
              <div className="stat-foot">Lifetime quality audits performed</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon Green"><CheckCircle2 size={20} /></div>
              <div className="stat-label">Approved (Ready for Handover)</div>
              <div className="stat-value" style={{ color: "#15945b" }}>
                {passedQcCount}
              </div>
              <div className="stat-foot">{qcYieldRate}% first-time pass yield</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon Red"><AlertTriangle size={20} /></div>
              <div className="stat-label">Rework Required</div>
              <div className="stat-value" style={{ color: "#b42318" }}>
                {failedQcCount}
              </div>
              <div className="stat-foot">{qcList.length > 0 ? Math.round((failedQcCount / qcList.length) * 100) : 0}% failure rate</div>
            </div>
          </div>

          {/* Rework Audit Log */}
          <section className="panel">
            <div className="section-head">
              <div>
                <h2>Quality Control Rework & Rejection Audit Log</h2>
                <p>Historical audit of failed QC checks, specific component failure reasons, and rework instructions</p>
              </div>
              <ShieldCheck size={19} className="muted" />
            </div>

            <div className="table-wrap desktop-reports-table" style={{ marginTop: "12px" }}>
              <table>
                <thead>
                  <tr>
                    <th>Audit Date</th>
                    <th>Linked Handset</th>
                    <th>Linked Job Card</th>
                    <th>Audit Result</th>
                    <th>Failure Reason</th>
                    <th>Rework Instructions for Bench</th>
                  </tr>
                </thead>
                <tbody>
                  {qcList.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", color: "#64748b", padding: "24px" }}>
                        No QC audits recorded yet.
                      </td>
                    </tr>
                  ) : (
                    qcList.map((qc) => {
                      const linkedDev = devices.find((d) => d.id === qc.device_id);
                      const linkedJob = jobs.find((j) => j.id === qc.job_card_id);

                      return (
                        <tr key={qc.id}>
                          <td style={{ fontSize: "11px", color: "#64748b" }}>
                            {qc.checked_at ? new Date(qc.checked_at).toLocaleDateString() : "—"}
                          </td>
                          <td>
                            <b>{linkedDev ? `${linkedDev.brand} ${linkedDev.model}` : qc.device_id.slice(0, 8)}</b>
                            <div style={{ fontSize: "10px", color: "#64748b" }}>
                              IMEI: {linkedDev?.imei || linkedDev?.imei1 || "N/A"}
                            </div>
                          </td>
                          <td>
                            {linkedJob ? (
                              <b style={{ color: "#0176d3" }}>#{linkedJob.job_number || linkedJob.id.slice(0, 8)}</b>
                            ) : (
                              <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Standalone</span>
                            )}
                          </td>
                          <td>
                            {qc.is_passed ? (
                              <span className="tag" style={{ background: "#e8f8f0", color: "#15945b", fontWeight: 700 }}>
                                ✓ Passed
                              </span>
                            ) : (
                              <span className="tag" style={{ background: "#fef2f2", color: "#b42318", fontWeight: 700 }}>
                                ✗ Rework Required
                              </span>
                            )}
                          </td>
                          <td style={{ maxWidth: "200px" }}>
                            {qc.failure_reason ? (
                              <span style={{ color: "#b42318", fontWeight: 600, fontSize: "12px" }}>
                                {qc.failure_reason}
                              </span>
                            ) : (
                              <span style={{ color: "#15945b", fontSize: "11px" }}>All 8 points verified</span>
                            )}
                          </td>
                          <td style={{ maxWidth: "250px", fontSize: "11px", color: "#475569" }}>
                            {qc.rework_notes || "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: ACCESSORIES VALUATION & MERCHANDISE */}
      {/* ========================================================================= */}
      {activeTab === "accessories" && (
        <div style={{ display: "grid", gap: "20px" }}>
          {/* Accessories Summary KPIs */}
          <div className="responsive-grid-4">
            <div className="stat-card">
              <div className="stat-icon Blue"><Tag size={20} /></div>
              <div className="stat-label">Total Accessory SKUs</div>
              <div className="stat-value">{accessories.length}</div>
              <div className="stat-foot">Catalogued accessory models</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon Purple"><Package size={20} /></div>
              <div className="stat-label">Total Units In Stock</div>
              <div className="stat-value">{accessories.reduce((s, a) => s + Number(a.current_stock || 0), 0)}</div>
              <div className="stat-foot">Units across all categories</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon Green"><DollarSign size={20} /></div>
              <div className="stat-label">Purchase Cost Valuation</div>
              <div className="stat-value" style={{ color: "#15945b" }}>
                ₹{accessories.reduce((s, a) => s + Number(a.current_stock || 0) * Number(a.purchase_price || 0), 0).toLocaleString("en-IN")}
              </div>
              <div className="stat-foot">Inventory purchase cost</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon Orange"><AlertTriangle size={20} /></div>
              <div className="stat-label">Low Stock Accessories</div>
              <div className="stat-value" style={{ color: accessories.filter((a) => a.current_stock <= a.minimum_stock).length > 0 ? "#b42318" : "#15945b" }}>
                {accessories.filter((a) => a.current_stock <= a.minimum_stock).length}
              </div>
              <div className="stat-foot">Items below minimum stock</div>
            </div>
          </div>

          {/* Category Breakdown Table */}
          <section className="panel">
            <div className="section-head">
              <div>
                <h2>Accessories Stock & Valuation by Category</h2>
                <p>Chargers, cables, covers, tempered glass, earphones, and power banks</p>
              </div>
              <Headphones size={19} className="muted" />
            </div>

            <div className="table-wrap desktop-reports-table" style={{ marginTop: "12px" }}>
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Product SKUs</th>
                    <th>Total Units In Stock</th>
                    <th>Purchase Valuation</th>
                    <th>Retail Valuation</th>
                    <th>Stock Health</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    "Chargers",
                    "USB cables",
                    "Mobile covers",
                    "Tempered glass",
                    "Earphones",
                    "Power banks",
                    "Other",
                  ].map((cat) => {
                    const groupItems = accessories.filter((a) => a.category.toLowerCase() === cat.toLowerCase());
                    const skuCount = groupItems.length;
                    const units = groupItems.reduce((s, a) => s + Number(a.current_stock || 0), 0);
                    const costVal = groupItems.reduce((s, a) => s + Number(a.current_stock || 0) * Number(a.purchase_price || 0), 0);
                    const retailVal = groupItems.reduce((s, a) => s + Number(a.current_stock || 0) * Number(a.selling_price || 0), 0);
                    const lowCount = groupItems.filter((a) => a.current_stock <= a.minimum_stock).length;

                    return (
                      <tr key={cat}>
                        <td><b>{cat}</b></td>
                        <td>{skuCount}</td>
                        <td><b>{units}</b> units</td>
                        <td><b style={{ color: "#334155" }}>₹{costVal.toLocaleString("en-IN")}</b></td>
                        <td><b style={{ color: "#059669" }}>₹{retailVal.toLocaleString("en-IN")}</b></td>
                        <td>
                          {lowCount > 0 ? (
                            <span className="tag" style={{ background: "#fef3c7", color: "#b45309", fontWeight: 700 }}>
                              ⚠ {lowCount} low stock
                            </span>
                          ) : (
                            <span className="tag" style={{ background: "#e8f8f0", color: "#15803d", fontWeight: 600 }}>
                              ✓ Healthy
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Low Stock Reorder List */}
          {accessories.some((a) => a.current_stock <= a.minimum_stock) && (
            <section className="panel" style={{ border: "1px solid #fed7aa", background: "#fffdfa" }}>
              <div className="section-head">
                <div>
                  <h2 style={{ color: "#c2410c" }}>Accessories Requiring Reorder</h2>
                  <p>Stock has fallen at or below safety reorder levels</p>
                </div>
                <AlertTriangle size={19} color="#ea580c" />
              </div>

              <div className="table-wrap desktop-reports-table" style={{ marginTop: "12px" }}>
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Accessory Name</th>
                      <th>Category</th>
                      <th>Current Units</th>
                      <th>Min Level</th>
                      <th>Unit Cost</th>
                      <th>Est. Reorder Cost (10 units)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accessories
                      .filter((a) => a.current_stock <= a.minimum_stock)
                      .map((item) => (
                        <tr key={item.id}>
                          <td><b style={{ fontFamily: "monospace", color: "#0176d3" }}>{item.sku}</b></td>
                          <td><b>{item.name}</b></td>
                          <td><span className="tag">{item.category}</span></td>
                          <td><b style={{ color: "#dc2626" }}>{item.current_stock}</b></td>
                          <td>{item.minimum_stock}</td>
                          <td>₹{Number(item.purchase_price).toFixed(2)}</td>
                          <td><b style={{ color: "#b45309" }}>₹{(Number(item.purchase_price) * 10).toFixed(2)}</b></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
