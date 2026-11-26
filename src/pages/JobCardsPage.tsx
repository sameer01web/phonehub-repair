import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ClipboardList,
  Plus,
  Search,
  RefreshCw,
  UserCheck,
  Wrench,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertCircle,
  IndianRupee,
  Smartphone,
  Eye,
  Calendar,
  Layers,
  CheckSquare,
  Truck,
  Sparkles,
  ShieldCheck,
  Check,
  Tag,
  Copy,
  Users,
  ChevronDown,
} from "lucide-react";
import {
  getJobCards,
  createJobCard,
  createJobCardWithDevice,
  assignTechnicianToJob,
  updateJobCardStatus,
  getDevices,
  getStaffProfiles,
  isStaffMemberActive,
  getJobIssuedParts,
  normalizeDeviceStatus,
  formatDeviceStatus,
  updateDevice,
  addDeviceTimelineEvent,
} from "../lib/repairs";
import { getSpareParts, issueSparePartFifo } from "../lib/inventory";
import CustomSelect from "../components/CustomSelect";
import { useAuth } from "../lib/auth";
import type { Job, Device, Part, Profile, StockLedgerEntry, TechnicianSpecialization } from "../lib/types";

const SPECIALIZATION_TASKS: Record<string, string[]> = {
  "Display specialist": ["Screen & OLED Replacement", "Touch Digitizer Repair", "Display Glass Refurbishment"],
  "Motherboard specialist": ["IC Reballing & Micro-soldering", "Short Circuit Tracing", "Power Management IC Replacement"],
  "Software specialist": ["OS Re-flashing & Bootloop Fix", "Firmware Upgrade", "FRP / Account Unlock Diagnostic"],
  "Camera specialist": ["Rear Camera Module Replacement", "Front Camera / FaceID Repair", "Camera Glass Lens Replacement"],
  "Hardware specialist": ["Charging Port / Flex Replacement", "Battery Replacement", "Speaker & Earpiece Repair"],
  "General mobile technician": ["General Hardware Diagnostic", "Full Cleaning & Inspection", "Accessory & Button Repair"],
};

export default function JobCardsPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [staffList, setStaffList] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [techFilter, setTechFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const s = searchParams.get("status");
    if (s) setStatusFilter(s);
    const p = searchParams.get("priority");
    if (p) setPriorityFilter(p);
  }, [searchParams]);

  // Modals
  const [showAddJob, setShowAddJob] = useState(false);
  const [showAssignTech, setShowAssignTech] = useState(false);
  const [showIssuePart, setShowIssuePart] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // View Details Modal
  const [viewJob, setViewJob] = useState<Job | null>(null);
  const [viewIssuedParts, setViewIssuedParts] = useState<StockLedgerEntry[]>([]);
  const [loadingParts, setLoadingParts] = useState(false);

  // Create Job Form State
  const [intakeMode, setIntakeMode] = useState<"new_phone" | "existing_phone">("new_phone");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [imei, setImei] = useState("");
  const [color, setColor] = useState("Black");
  const [storage, setStorage] = useState("128GB");
  const [condition, setCondition] = useState("Good");
  const [existingDeviceId, setExistingDeviceId] = useState("");

  const [title, setTitle] = useState("");
  const [complaint, setComplaint] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [estimatedCost, setEstimatedCost] = useState("0");
  const [internalNotes, setInternalNotes] = useState("");
  const [initialTechId, setInitialTechId] = useState("");
  const [initialTask, setInitialTask] = useState("Screen & Touch Replacement");
  const [initialLaborCost, setInitialLaborCost] = useState("400");

  // Assign Technician Form
  const [assignTechId, setAssignTechId] = useState("");
  const [selectedSpec, setSelectedSpec] = useState<string>("Display specialist");
  const [taskName, setTaskName] = useState("Screen & OLED Replacement");
  const [laborCost, setLaborCost] = useState("400");

  // Issue Part Form
  const [partId, setPartId] = useState("");
  const [partQty, setPartQty] = useState("1");

  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [jobList, devList, partList, staff] = await Promise.all([
        getJobCards(),
        getDevices(),
        getSpareParts(),
        getStaffProfiles(),
      ]);
      setJobs(jobList);
      setDevices(
        devList.filter((d) => {
          const st = normalizeDeviceStatus(d.status);
          return st !== "scrapped";
        })
      );
      setParts(partList);
      setStaffList(staff);
    } catch (err: any) {
      setError(err?.message || "Failed to load job cards");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleOpenAddJob() {
    setShowAddJob(true);
    setBrand("");
    setModel("");
    setImei("");
    setColor("Black");
    setStorage("128GB");
    setCondition("Good");
    setExistingDeviceId("");
    setTitle("");
    setComplaint("");
    setDiagnosis("");
    setPriority("Normal");
    setEstimatedCost("0");
    setInternalNotes("");
    setInitialTechId(staffList.find((s) => s.role === "technician")?.id || "");
    setInitialTask("General Hardware Diagnostic");
    setInitialLaborCost("350");
  }

  async function handleCreateJob(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (intakeMode === "new_phone") {
        if (!brand.trim() || !model.trim()) {
          throw new Error("Please enter phone brand and model for intake.");
        }
        await createJobCardWithDevice({
          brand: brand.trim(),
          model: model.trim(),
          imei: imei.trim() || null,
          color: color.trim() || "Black",
          condition: condition.trim() || "Good",
          complaint: complaint.trim() || title.trim() || "General repair request",
          diagnosis: diagnosis.trim() || null,
          priority,
          estimated_cost: Number(estimatedCost || 0),
          internal_notes: `[Storage: ${storage}] ${internalNotes.trim()}`.trim(),
          technician_id: initialTechId || null,
          task_name: initialTask.trim() || "Repair & Diagnostics",
          labor_cost: Number(initialLaborCost || 0),
        });
        setSuccess(`New repair job card created for ${brand} ${model}.`);
      } else {
        if (!existingDeviceId) {
          throw new Error("Please choose an existing handset.");
        }
        const job = await createJobCard({
          device_id: existingDeviceId,
          title: title.trim() || `Repair: ${complaint.slice(0, 30)}`,
          complaint: complaint.trim() || undefined,
          diagnosis: diagnosis.trim() || undefined,
          priority,
          estimated_cost: Number(estimatedCost || 0),
        });
        if (initialTechId) {
          await assignTechnicianToJob(
            job.id,
            initialTechId,
            initialTask.trim() || "Repair Task",
            Number(initialLaborCost || 0)
          );
        }
        setSuccess("Job card opened and handset moved to repair status.");
      }

      setShowAddJob(false);
      setTimeout(() => setSuccess(null), 4000);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to create repair job card");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssignTech(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedJob) return;
    setSubmitting(true);
    setError(null);
    try {
      await assignTechnicianToJob(
        selectedJob.id,
        assignTechId || user?.id || "00000000-0000-0000-0000-000000000000",
        `[${selectedSpec}] ${taskName.trim()}`,
        Number(laborCost || 0)
      );
      setShowAssignTech(false);
      setSuccess(`Task "${taskName}" assigned to technician.`);
      setTimeout(() => setSuccess(null), 4000);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to assign technician");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleIssuePart(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedJob) return;
    if (!partId) {
      setError("Please select a spare part from the catalogue.");
      return;
    }
    const selectedPart = parts.find((p) => p.id === partId);
    const qty = Number(partQty || 1);
    if (qty <= 0) {
      setError("Quantity to deduct must be at least 1.");
      return;
    }
    const availableStock = Number(selectedPart?.quantity ?? selectedPart?.current_stock ?? 0);
    if (qty > availableStock) {
      setError(`Insufficient stock: Only ${availableStock} units available for ${selectedPart?.name || 'this part'}.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await issueSparePartFifo(partId, qty, selectedJob.id);
      setShowIssuePart(false);
      setSuccess(`Issued ${qty} unit(s) of ${selectedPart?.name || 'part'} via FIFO. ₹${Number(res.total_fifo_cost || 0).toLocaleString("en-IN")} allocated to Job #${selectedJob.job_number}.`);
      setTimeout(() => setSuccess(null), 5000);
      await loadData();
      const partsIssued = await getJobIssuedParts(selectedJob.id);
      setViewIssuedParts(partsIssued);
      if (viewJob && viewJob.id === selectedJob.id) {
        const partsCost = partsIssued.reduce((sum, p) => sum + (Number(p.quantity || 0) * Number(p.unit_cost || 0)), 0);
        setViewJob((prev) => prev ? { ...prev, actual_parts_cost: partsCost } : null);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to issue spare part");
    } finally {
      setSubmitting(false);
    }
  }

  // Step-by-Step Transition Handler
  async function handleStatusChange(jobId: string, newStatus: string) {
    setError(null);
    const prevJobs = [...jobs];
    // Optimistically update UI so dropdown & badge change instantly
    setJobs((current) =>
      current.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j))
    );

    try {
      await updateJobCardStatus(jobId, newStatus);

      // If status is completed or in_progress, synchronize device status
      const targetJob = jobs.find((j) => j.id === jobId);
      if (targetJob?.device_id) {
        try {
          if (newStatus === "completed") {
            await updateDevice(targetJob.device_id, { status: "ready_for_sale" });
            await addDeviceTimelineEvent(
              targetJob.device_id,
              "repair",
              "Repair Completed",
              `Handset repair marked completed for Job #${targetJob.job_number || targetJob.id.slice(0, 6)}.`
            );
          } else if (newStatus === "in_progress") {
            await updateDevice(targetJob.device_id, { status: "in_repair" });
          }
        } catch {
          // Device sync is non-blocking
        }
      }

      setSuccess(`Job Card updated to "${newStatus.replace(/_/g, " ")}".`);
      setTimeout(() => setSuccess(null), 4000);
      await loadData();
    } catch (err: any) {
      setJobs(prevJobs);
      setError(err?.message || "Failed to update job card status");
    }
  }

  // Deliver Phone Handler
  async function handleDeliverPhone(job: Job) {
    if (!window.confirm(`Mark handset ${job.device?.brand} ${job.device?.model} as DELIVERED to owner?`)) {
      return;
    }
    setError(null);
    try {
      await updateJobCardStatus(job.id, "completed");
      if (job.device_id) {
        await updateDevice(job.device_id, { status: "ready_for_sale" });
        await addDeviceTimelineEvent(
          job.device_id,
          "delivery",
          "Handset Delivered / Released",
          `Repaired handset successfully delivered to customer. Total cost: ₹${job.actual_labor_cost + (job.estimated_cost || 0)}.`
        );
      }
      setSuccess(`Job #${job.job_number} marked Delivered & Completed.`);
      setTimeout(() => setSuccess(null), 4000);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to deliver handset");
    }
  }

  async function handleOpenDetails(job: Job) {
    setViewJob(job);
    setLoadingParts(true);
    try {
      const partsIssued = await getJobIssuedParts(job.id);
      setViewIssuedParts(partsIssued);
    } catch {
      setViewIssuedParts([]);
    } finally {
      setLoadingParts(false);
    }
  }

  // Filter jobs across Search, Status, Priority, Technician
  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "in_progress") {
          if (j.status !== "in_progress" && j.status !== "assigned") return false;
        } else if (statusFilter === "completed") {
          if (j.status !== "completed" && j.status !== "delivered") return false;
        } else if (statusFilter === "qc_pending") {
          if (j.status !== "qc_pending" && j.status !== "qc_testing") return false;
        } else if (j.status !== statusFilter) {
          return false;
        }
      }
      // Priority filter
      if (priorityFilter !== "all" && j.priority?.toLowerCase() !== priorityFilter.toLowerCase()) {
        return false;
      }
      // Tech filter
      if (techFilter !== "all") {
        const hasTech = j.assignments?.some((a) => a.technician_id === techFilter);
        if (!hasTech) return false;
      }
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const jobNum = String(j.job_number || "").toLowerCase();
        const brandStr = (j.device?.brand || "").toLowerCase();
        const modelStr = (j.device?.model || "").toLowerCase();
        const imeiStr = (j.device?.imei1 || j.device?.imei || "").toLowerCase();
        const complaintStr = (j.complaint || "").toLowerCase();
        const diagStr = (j.diagnosis || "").toLowerCase();
        const titleStr = (j.title || "").toLowerCase();
        return (
          jobNum.includes(q) ||
          brandStr.includes(q) ||
          modelStr.includes(q) ||
          imeiStr.includes(q) ||
          complaintStr.includes(q) ||
          diagStr.includes(q) ||
          titleStr.includes(q)
        );
      }
      return true;
    });
  }, [jobs, statusFilter, search, priorityFilter, techFilter]);

  // Overall Repair Metrics
  const totalJobs = jobs.length;
  const receivedCount = jobs.filter((j) => j.status === "received").length;
  const inProgressCount = jobs.filter((j) => j.status === "in_progress" || j.status === "assigned").length;
  const qcPendingCount = jobs.filter((j) => j.status === "qc_pending").length;
  const completedCount = jobs.filter((j) => j.status === "completed" || j.status === "delivered").length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">WORKSHOP & REPAIRS</div>
          <h1>Repair Job Cards & Bench Workflow</h1>
          <p>
            Track repair tickets across full lifecycle: Received → Assigned → In Repair → QC Testing → Completed → Delivered.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="primary-btn" onClick={handleOpenAddJob}>
            <Plus size={16} /> Open Repair Job Card
          </button>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}
      {success && (
        <div className="notice success">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {/* Repair Workflow Pulse Stats (Interactive / Clickable Filter Cards) */}
      <div className="responsive-grid-5" style={{ marginBottom: "16px" }}>
        <div
          onClick={() => setStatusFilter("all")}
          className={`stat-card clickable ${statusFilter === "all" ? "active" : ""}`}
          style={{ cursor: "pointer", position: "relative" }}
          title="Click to view all repair jobs"
        >
          <div className="stat-icon Blue"><ClipboardList size={20} /></div>
          <div>
            <div className="stat-label">Total Repair Jobs</div>
            <div className="stat-val">{totalJobs}</div>
            <div className="stat-meta">Overall tickets opened</div>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === "received" ? "all" : "received")}
          className={`stat-card clickable ${statusFilter === "received" ? "active" : ""}`}
          style={{ cursor: "pointer", position: "relative" }}
          title="Click to filter received intake tickets awaiting assignment"
        >
          <div className="stat-icon Blue"><Clock size={20} /></div>
          <div>
            <div className="stat-label">Received / Intake</div>
            <div className="stat-val">{receivedCount}</div>
            <div className="stat-meta">Awaiting assignment</div>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === "in_progress" ? "all" : "in_progress")}
          className={`stat-card clickable ${statusFilter === "in_progress" ? "active" : ""}`}
          style={{ cursor: "pointer", position: "relative" }}
          title="Click to filter active repairs on technician bench"
        >
          <div className="stat-icon Orange"><Wrench size={20} /></div>
          <div>
            <div className="stat-label">Under Active Repair</div>
            <div className="stat-val">{inProgressCount}</div>
            <div className="stat-meta">Assigned to technician bench</div>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === "qc_pending" ? "all" : "qc_pending")}
          className={`stat-card clickable ${statusFilter === "qc_pending" ? "active" : ""}`}
          style={{ cursor: "pointer", position: "relative" }}
          title="Click to filter jobs pending QC verification"
        >
          <div className="stat-icon Orange"><ShieldCheck size={20} /></div>
          <div>
            <div className="stat-label">QC Testing Gate</div>
            <div className="stat-val">{qcPendingCount}</div>
            <div className="stat-meta">Under quality verification</div>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === "completed" ? "all" : "completed")}
          className={`stat-card clickable ${statusFilter === "completed" ? "active" : ""}`}
          style={{ cursor: "pointer", position: "relative" }}
          title="Click to filter completed and delivered repairs"
        >
          <div className="stat-icon Green"><CheckCircle2 size={20} /></div>
          <div>
            <div className="stat-label">Completed & Delivered</div>
            <div className="stat-val">{completedCount}</div>
            <div className="stat-meta">Handed over to customer</div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="jobs-toolbar-container">
          <div className="jobs-search-and-actions">
            <div className="searchbox jobs-searchbox" style={{ flex: 1 }}>
              <Search size={16} />
              <input
                placeholder="Search by Job #, brand, model, IMEI, or issue..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Filters Grid */}
          <div className="jobs-filters-grid">
            {/* Status Filter */}
            <CustomSelect
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "All Statuses" },
                { value: "received", label: "Received / Intake" },
                { value: "assigned", label: "Assigned to Tech" },
                { value: "in_progress", label: "In Repair" },
                { value: "waiting_for_parts", label: "Waiting for Parts" },
                { value: "qc_pending", label: "QC Testing" },
                { value: "completed", label: "Completed / Delivered" },
                { value: "cancelled", label: "Cancelled" },
              ]}
              minWidth="160px"
            />

            {/* Priority Filter */}
            <CustomSelect
              label="Priority"
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={[
                { value: "all", label: "All Priorities" },
                { value: "urgent", label: "Urgent" },
                { value: "high", label: "High" },
                { value: "normal", label: "Normal" },
                { value: "low", label: "Low" },
              ]}
              minWidth="140px"
            />

            {/* Technician Filter */}
            <CustomSelect
              label="Technician"
              value={techFilter}
              onChange={setTechFilter}
              options={[
                { value: "all", label: "All Technicians" },
                ...staffList
                  .filter((s) => (s.role === "technician" || s.role === "owner" || s.role === "workshop_manager") && isStaffMemberActive(s))
                  .map((tech) => ({
                    value: tech.id,
                    label: `${tech.full_name || "Technician"} (${tech.role.replace(/_/g, " ")})`,
                  })),
              ]}
              minWidth="170px"
            />
          </div>

          <div className="jobs-meta-bar">
            <button className="icon-btn" onClick={loadData} title="Refresh">
              <RefreshCw size={16} />
            </button>
            <span
              className="count"
              style={{
                background: "#f1f5f9",
                color: "#475569",
                fontSize: "12px",
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: "20px",
              }}
            >
              📋 {filteredJobs.length} job card{filteredJobs.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* 1. Desktop View: Comprehensive 8-column Table */}
        <div className="table-wrap desktop-jobs-table">
          <table>
            <thead>
              <tr>
                <th>Job #</th>
                <th>Phone Model & IMEI</th>
                <th>Reported Problem / Diagnosis</th>
                <th>Priority</th>
                <th>Status & Workflow</th>
                <th>Assigned Technician(s)</th>
                <th>Quick Actions</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="empty">Loading repair job cards…</td>
                </tr>
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty">
                    No repair tickets match the active filters. Click "Open Repair Job Card" to start a repair.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((j) => {
                  const isCompleted = j.status === "completed";
                  const isInProgress = j.status === "in_progress";
                  const isQc = j.status === "qc_pending";
                  const isAssigned = j.status === "assigned";
                  const isReceived = j.status === "received";

                  return (
                    <tr key={j.id}>
                      <td>
                        <b style={{ color: "#0176d3", fontSize: "13px" }}>
                          <code>#{j.job_number || j.id.slice(0, 6)}</code>
                        </b>
                        <div style={{ fontSize: "10px", color: "#8291a5" }}>
                          {new Date(j.created_at).toLocaleDateString("en-IN")}
                        </div>
                      </td>

                      <td>
                        <b>{j.device?.brand} {j.device?.model}</b>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>
                          IMEI: <code>{j.device?.imei1 || "N/A"}</code>
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: "#152b49", fontSize: "12px" }}>
                          {j.complaint || j.title}
                        </div>
                        {j.diagnosis && (
                          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                            Diag: {j.diagnosis}
                          </div>
                        )}
                      </td>

                      <td>
                        <span
                          className="tag"
                          style={{
                            background:
                              j.priority?.toLowerCase() === "urgent"
                                ? "#fef2f2"
                                : j.priority?.toLowerCase() === "high"
                                ? "#fff5eb"
                                : "#edf5fc",
                            color:
                              j.priority?.toLowerCase() === "urgent"
                                ? "#b42318"
                                : j.priority?.toLowerCase() === "high"
                                ? "#e68a2e"
                                : "#0176d3",
                            fontWeight: 700,
                          }}
                        >
                          {j.priority}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: "grid", gap: "4px" }}>
                          <span
                            className="tag"
                            style={{
                              textTransform: "capitalize",
                              fontWeight: 700,
                              background: isCompleted ? "#e8f8f0" : isInProgress ? "#fff2e5" : isQc ? "#f1edff" : "#edf5fc",
                              color: isCompleted ? "#15945b" : isInProgress ? "#e68a2e" : isQc ? "#7955c7" : "#0176d3",
                            }}
                          >
                            {j.status.replace(/_/g, " ")}
                          </span>

                          <select
                            value={j.status}
                            onChange={(e) => handleStatusChange(j.id, e.target.value)}
                            style={{
                              height: "26px",
                              border: "1px solid #e0e7ef",
                              borderRadius: "4px",
                              padding: "0 4px",
                              fontSize: "10px",
                              background: "#fff",
                            }}
                          >
                            <option value="received">Received / Intake</option>
                            <option value="assigned">Assigned</option>
                            <option value="in_progress">In Repair</option>
                            <option value="waiting_for_parts">Waiting Parts</option>
                            <option value="qc_pending">QC Testing</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                      </td>

                      <td>
                        {(j.assignments || []).length === 0 ? (
                          <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>
                            Unassigned
                          </span>
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {j.assignments?.map((a) => (
                              <span key={a.id} className="tag" style={{ background: "#f1edff", color: "#7955c7", fontSize: "11px" }}>
                                {a.task_name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Step-by-Step Technician Actions */}
                      <td>
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
                          {/* Assign Tech */}
                          <button
                            className="secondary-btn"
                            style={{ padding: "3px 6px", fontSize: "10px" }}
                            onClick={() => {
                              setSelectedJob(j);
                              setAssignTechId(staffList.find((s) => s.role === "technician")?.id || user?.id || "");
                              setShowAssignTech(true);
                            }}
                            title="Assign technician & task"
                          >
                            <UserCheck size={12} /> Assign
                          </button>

                          {/* Quick Start Repair */}
                          {(isReceived || isAssigned) && (
                            <button
                              className="secondary-btn"
                              style={{ padding: "3px 6px", fontSize: "10px", color: "#e68a2e" }}
                              onClick={() => handleStatusChange(j.id, "in_progress")}
                              title="Begin bench repair"
                            >
                              <Wrench size={12} /> Start
                            </button>
                          )}

                          {/* Issue FIFO Parts */}
                          <button
                            className="secondary-btn"
                            style={{ padding: "3px 6px", fontSize: "10px" }}
                            onClick={() => {
                              setSelectedJob(j);
                              const availablePart = parts.find((p) => (p.quantity || p.current_stock || 0) > 0) || parts[0];
                              setPartId(availablePart?.id || "");
                              setPartQty("1");
                              setShowIssuePart(true);
                            }}
                            title="Issue spare part from FIFO inventory"
                          >
                            <Wrench size={12} /> Part
                          </button>

                          {/* Route to QC */}
                          {isInProgress && (
                            <button
                              className="secondary-btn"
                              style={{ padding: "3px 6px", fontSize: "10px", color: "#7955c7" }}
                              onClick={() => handleStatusChange(j.id, "qc_pending")}
                              title="Submit for QC testing"
                            >
                              <ShieldCheck size={12} /> To QC
                            </button>
                          )}

                          {/* Deliver Phone */}
                          {!isCompleted ? (
                            <button
                              className="secondary-btn"
                              style={{ padding: "3px 6px", fontSize: "10px", color: "#15945b" }}
                              onClick={() => handleDeliverPhone(j)}
                              title="Mark repair completed and phone delivered"
                            >
                              <Truck size={12} /> Deliver
                            </button>
                          ) : (
                            <span style={{ fontSize: "10px", color: "#15945b", fontWeight: 700 }}>
                              ✓ Delivered
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <button
                          className="secondary-btn"
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                          onClick={() => handleOpenDetails(j)}
                          title="View complete repair breakdown & parts used"
                        >
                          <Eye size={13} /> View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 2. Mobile View: Touch-Friendly Responsive Job Cards */}
        <div className="mobile-jobs-cards">
          {loading ? (
            <div style={{ textAlign: "center", padding: "30px 10px", color: "#64748b", fontSize: "13px" }}>
              Loading repair job cards…
            </div>
          ) : filteredJobs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 10px", color: "#64748b", fontSize: "13px", background: "#f8fafc", borderRadius: "8px" }}>
              No repair tickets match the active filters. Click "Open Repair Job Card" to start a repair.
            </div>
          ) : (
            filteredJobs.map((j) => {
              const isCompleted = j.status === "completed";
              const isInProgress = j.status === "in_progress";
              const isQc = j.status === "qc_pending";
              const isAssigned = j.status === "assigned";
              const isReceived = j.status === "received";

              return (
                <div key={j.id} className="mobile-job-card">
                  {/* Card Header: Job ID, Date, Priority, and Status */}
                  <div className="mobile-job-header">
                    <div className="mobile-job-id-wrap">
                      <span className="mobile-job-badge-id">#{j.job_number || j.id.slice(0, 8)}</span>
                      <span className="mobile-job-date">
                        {new Date(j.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <div className="mobile-job-tags-group">
                      <span
                        className="tag"
                        style={{
                          background:
                            j.priority?.toLowerCase() === "urgent"
                              ? "#fee2e2"
                              : j.priority?.toLowerCase() === "high"
                              ? "#ffedd5"
                              : "#eff6ff",
                          color:
                            j.priority?.toLowerCase() === "urgent"
                              ? "#b91c1c"
                              : j.priority?.toLowerCase() === "high"
                              ? "#c2410c"
                              : "#1d4ed8",
                          fontWeight: 700,
                          fontSize: "10.5px",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          textTransform: "capitalize",
                        }}
                      >
                        {j.priority || "Normal"}
                      </span>
                      <span
                        className="tag"
                        style={{
                          background: isCompleted ? "#dcfce7" : isInProgress ? "#fef3c7" : isQc ? "#ede9fe" : "#f1f5f9",
                          color: isCompleted ? "#15803d" : isInProgress ? "#b45309" : isQc ? "#6d28d9" : "#475569",
                          fontWeight: 700,
                          fontSize: "10.5px",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          textTransform: "capitalize",
                        }}
                      >
                        {j.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>

                  {/* Device & IMEI Banner */}
                  <div className="mobile-job-device-banner">
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div className="device-avatar-icon">
                        <Smartphone size={17} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
                          {j.device?.brand} {j.device?.model}
                        </div>
                        {j.device?.storage_capacity && (
                          <span style={{ fontSize: "11px", color: "#64748b" }}>
                            {j.device?.storage_capacity} {j.device?.color ? `• ${j.device?.color}` : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    {j.device?.imei1 && (
                      <div className="mobile-imei-chip">
                        <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 600 }}>IMEI</span>
                        <code style={{ fontSize: "11px", fontWeight: 700, color: "#1e293b" }}>{j.device?.imei1}</code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(j.device?.imei1 || "");
                            setSuccess(`Copied IMEI ${j.device?.imei1}`);
                            setTimeout(() => setSuccess(null), 2500);
                          }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#0176d3", padding: "2px", display: "grid", placeItems: "center" }}
                          title="Copy IMEI"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Reported Problem / Complaint */}
                  {(j.complaint || j.title || j.diagnosis) && (
                    <div className="mobile-job-complaint-box">
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "7px" }}>
                        <Wrench size={14} style={{ color: "#0176d3", flexShrink: 0, marginTop: "2px" }} />
                        <div style={{ flex: 1 }}>
                          <b style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "2px", letterSpacing: "0.3px" }}>
                            Reported Issue / Problem
                          </b>
                          <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#1e293b", lineHeight: "1.35" }}>
                            {j.complaint || j.title}
                          </div>
                          {j.diagnosis && (
                            <div style={{ marginTop: "6px", paddingTop: "6px", borderTop: "1px dashed #cbd5e1", fontSize: "11px", color: "#0369a1" }}>
                              <b>Technician Diag:</b> {j.diagnosis}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Assigned Technicians & Bench Tasks */}
                  <div className="mobile-job-tech-box">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                        <Users size={12} style={{ color: "#64748b" }} />
                        <span>Assigned Technician & Tasks:</span>
                      </div>
                      {(j.assignments || []).length > 0 && (
                        <span style={{ fontSize: "10px", fontWeight: 700, background: "#ede9fe", color: "#6d28d9", padding: "1px 6px", borderRadius: "8px" }}>
                          {(j.assignments || []).length} assigned
                        </span>
                      )}
                    </div>

                    {(j.assignments || []).length === 0 ? (
                      <div style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic", background: "#f8fafc", padding: "6px 8px", borderRadius: "6px" }}>
                        Unassigned — No technician assigned yet
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                        {j.assignments?.map((a) => {
                          let spec = "";
                          let taskName = a.task_name || "Repair task";
                          const match = taskName.match(/^\[(.*?)\]\s*(.*)$/);
                          if (match) {
                            spec = match[1];
                            taskName = match[2];
                          }
                          const techProfile = staffList.find((s) => s.id === a.technician_id);
                          return (
                            <div
                              key={a.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "6px 9px",
                                background: "#ffffff",
                                border: "1px solid #e2e8f0",
                                borderRadius: "6px",
                                gap: "8px",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, flex: 1 }}>
                                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#7955c7", flexShrink: 0 }} />
                                <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {taskName}
                                </span>
                                {spec && (
                                  <span style={{ fontSize: "9px", fontWeight: 600, background: "#e0f2fe", color: "#0369a1", padding: "1px 5px", borderRadius: "4px", flexShrink: 0 }}>
                                    {spec}
                                  </span>
                                )}
                              </div>
                              {techProfile && (
                                <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 600, flexShrink: 0 }}>
                                  {techProfile.full_name?.split(" ")[0]}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Quick Workflow Status Dropdown Row */}
                  <div className="mobile-job-status-row">
                    <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.2px" }}>
                      Workflow Status:
                    </span>
                    <select
                      value={j.status}
                      onChange={(e) => handleStatusChange(j.id, e.target.value)}
                      className="mobile-status-select-control"
                    >
                      <option value="received">Received / Intake</option>
                      <option value="assigned">Assigned to Tech</option>
                      <option value="in_progress">Under Active Repair</option>
                      <option value="waiting_for_parts">Waiting for Parts</option>
                      <option value="qc_pending">QC Testing Gate</option>
                      <option value="completed">Completed</option>
                      <option value="delivered">Delivered to Customer</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  {/* 2x2 Balanced Action Buttons Grid */}
                  <div className="mobile-job-grid-actions">
                    <button
                      type="button"
                      className="secondary-btn"
                      style={{ padding: "8px 8px", fontSize: "11.5px", justifyContent: "center", borderRadius: "7px", fontWeight: 600 }}
                      onClick={() => {
                        setSelectedJob(j);
                        setAssignTechId(staffList.find((s) => s.role === "technician")?.id || user?.id || "");
                        setShowAssignTech(true);
                      }}
                      title="Assign technician & task"
                    >
                      <UserCheck size={13} /> Assign Tech
                    </button>

                    <button
                      type="button"
                      className="secondary-btn"
                      style={{ padding: "8px 8px", fontSize: "11.5px", justifyContent: "center", borderRadius: "7px", fontWeight: 600 }}
                      onClick={() => {
                        setSelectedJob(j);
                        const availablePart = parts.find((p) => (p.quantity || p.current_stock || 0) > 0) || parts[0];
                        setPartId(availablePart?.id || "");
                        setPartQty("1");
                        setShowIssuePart(true);
                      }}
                      title="Issue spare part"
                    >
                      <Wrench size={13} /> + Part (FIFO)
                    </button>

                    {/* Third Button: Lifecycle Action */}
                    {(isReceived || isAssigned) ? (
                      <button
                        type="button"
                        className="primary-btn"
                        style={{ padding: "8px 8px", fontSize: "11.5px", justifyContent: "center", borderRadius: "7px", background: "#f59e0b", borderColor: "#d97706" }}
                        onClick={() => handleStatusChange(j.id, "in_progress")}
                        title="Begin bench repair"
                      >
                        <Wrench size={13} /> Start Repair
                      </button>
                    ) : isInProgress ? (
                      <button
                        type="button"
                        className="primary-btn"
                        style={{ padding: "8px 8px", fontSize: "11.5px", justifyContent: "center", borderRadius: "7px", background: "#7955c7", borderColor: "#6b46c1" }}
                        onClick={() => handleStatusChange(j.id, "qc_pending")}
                        title="Submit for QC testing"
                      >
                        <ShieldCheck size={13} /> To QC Gate
                      </button>
                    ) : !isCompleted ? (
                      <button
                        type="button"
                        className="primary-btn"
                        style={{ padding: "8px 8px", fontSize: "11.5px", justifyContent: "center", borderRadius: "7px", background: "#16a34a", borderColor: "#15803d" }}
                        onClick={() => handleDeliverPhone(j)}
                        title="Mark repair completed and phone delivered"
                      >
                        <Truck size={13} /> Deliver
                      </button>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", background: "#dcfce7", color: "#15803d", borderRadius: "7px", fontSize: "11.5px", fontWeight: 700, padding: "8px 8px" }}>
                        ✓ Delivered
                      </div>
                    )}

                    {/* Fourth Button: View Details */}
                    <button
                      type="button"
                      className="secondary-btn"
                      style={{
                        padding: "8px 8px",
                        fontSize: "11.5px",
                        justifyContent: "center",
                        borderRadius: "7px",
                        fontWeight: 600,
                        color: "#0176d3",
                        background: "#eff6ff",
                        borderColor: "#bfdbfe",
                      }}
                      onClick={() => handleOpenDetails(j)}
                      title="View full ticket details & history"
                    >
                      <Eye size={13} /> View Details
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL: OPEN REPAIR JOB CARD */}
      {showAddJob && (
        <div className="modal-backdrop">
          <form
            className="modal"
            onSubmit={handleCreateJob}
            style={{
              maxWidth: "600px",
              width: "100%",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              padding: "18px 20px 16px",
              boxSizing: "border-box",
              overflow: "hidden",
              borderRadius: "16px",
            }}
          >
            <div className="modal-head" style={{ flexShrink: 0, marginBottom: "12px", paddingBottom: "10px", borderBottom: "1px solid #f1f5f9" }}>
              <div>
                <h2 style={{ fontSize: "16px", color: "#0f172a", margin: "0 0 3px 0" }}>Open Repair Job Card</h2>
                <p style={{ fontSize: "11.5px", color: "#64748b", margin: 0 }}>Register incoming handset and open an active bench repair ticket.</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowAddJob(false)}>×</button>
            </div>

            {/* Scrollable Modal Body with thin scrollbar */}
            <div className="modal-scroll-body" style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", paddingRight: "4px" }}>
              {/* Intake Mode Segmented Control */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  background: "#f1f5f9",
                  padding: "4px",
                  borderRadius: "9px",
                  marginBottom: "16px",
                  gap: "4px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIntakeMode("new_phone")}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "7px",
                    border: "none",
                    background: intakeMode === "new_phone" ? "#ffffff" : "transparent",
                    color: intakeMode === "new_phone" ? "#0176d3" : "#64748b",
                    fontWeight: intakeMode === "new_phone" ? 700 : 500,
                    fontSize: "12px",
                    boxShadow: intakeMode === "new_phone" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    cursor: "pointer",
                    textAlign: "center",
                    transition: "all 0.15s ease",
                  }}
                >
                  + New Handset Intake
                </button>
                <button
                  type="button"
                  onClick={() => setIntakeMode("existing_phone")}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "7px",
                    border: "none",
                    background: intakeMode === "existing_phone" ? "#ffffff" : "transparent",
                    color: intakeMode === "existing_phone" ? "#0176d3" : "#64748b",
                    fontWeight: intakeMode === "existing_phone" ? 700 : 500,
                    fontSize: "12px",
                    boxShadow: intakeMode === "existing_phone" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    cursor: "pointer",
                    textAlign: "center",
                    transition: "all 0.15s ease",
                  }}
                >
                  Select from Inventory
                </button>
              </div>

              {intakeMode === "new_phone" ? (
                <div className="form-grid">
                  <label style={{ fontSize: "11.5px", color: "#475569", fontWeight: 600 }}>
                    Brand *
                    <input
                      required
                      placeholder="e.g. Apple, Samsung, Xiaomi"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      style={{ height: "38px", border: "1.5px solid #cbd5e1", borderRadius: "8px", padding: "0 10px", fontSize: "12.5px" }}
                    />
                  </label>
                  <label style={{ fontSize: "11.5px", color: "#475569", fontWeight: 600 }}>
                    Model *
                    <input
                      required
                      placeholder="e.g. iPhone 15 Pro, Galaxy S24"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      style={{ height: "38px", border: "1.5px solid #cbd5e1", borderRadius: "8px", padding: "0 10px", fontSize: "12.5px" }}
                    />
                  </label>
                  <label style={{ fontSize: "11.5px", color: "#475569", fontWeight: 600 }}>
                    IMEI Number (14-16 digits)
                    <input
                      placeholder="e.g. 354890098765432"
                      value={imei}
                      onChange={(e) => setImei(e.target.value)}
                      style={{ height: "38px", border: "1.5px solid #cbd5e1", borderRadius: "8px", padding: "0 10px", fontSize: "12.5px" }}
                    />
                  </label>
                  <label style={{ fontSize: "11.5px", color: "#475569", fontWeight: 600 }}>
                    Color
                    <input
                      placeholder="e.g. Black, Blue, Gold"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      style={{ height: "38px", border: "1.5px solid #cbd5e1", borderRadius: "8px", padding: "0 10px", fontSize: "12.5px" }}
                    />
                  </label>
                  <label style={{ gridColumn: "1 / -1", fontSize: "11.5px", color: "#475569", fontWeight: 600 }}>
                    Storage Capacity
                    <select
                      value={storage}
                      onChange={(e) => setStorage(e.target.value)}
                      style={{ height: "38px", border: "1.5px solid #cbd5e1", borderRadius: "8px", padding: "0 10px", fontSize: "12.5px", background: "#fff" }}
                    >
                      <option value="64GB">64GB</option>
                      <option value="128GB">128GB</option>
                      <option value="256GB">256GB</option>
                      <option value="512GB">512GB</option>
                      <option value="1TB">1TB</option>
                    </select>
                  </label>
                </div>
              ) : (
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ fontSize: "11.5px", color: "#475569", fontWeight: 600, display: "grid", gap: "6px" }}>
                    Select Phone from Inventory:
                    <select
                      value={existingDeviceId}
                      onChange={(e) => setExistingDeviceId(e.target.value)}
                      style={{
                        width: "100%",
                        maxWidth: "100%",
                        height: "40px",
                        border: "1.5px solid #cbd5e1",
                        borderRadius: "8px",
                        padding: "0 34px 0 12px",
                        fontSize: "12.5px",
                        color: existingDeviceId ? "#0f172a" : "#64748b",
                        background: "#ffffff",
                        outline: "none",
                        fontWeight: 600,
                        boxSizing: "border-box",
                        cursor: "pointer",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                      }}
                    >
                      <option value="">-- Choose Phone from Inventory --</option>
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.brand} {d.model} {d.imei1 ? `• ${d.imei1.slice(0, 8)}...` : ""} ({formatDeviceStatus(d.status)})
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* Selected Device Preview Card */}
                  {(() => {
                    if (!existingDeviceId) return null;
                    const selectedDev = devices.find((d) => d.id === existingDeviceId);
                    if (!selectedDev) return null;
                    return (
                      <div
                        style={{
                          marginTop: "8px",
                          background: "#f0f7ff",
                          border: "1px solid #bfdbfe",
                          borderRadius: "8px",
                          padding: "8px 12px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <b style={{ color: "#0176d3", fontSize: "13px" }}>{selectedDev.brand} {selectedDev.model}</b>
                          <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>
                            IMEI: <code style={{ color: "#0f172a", fontWeight: 700 }}>{selectedDev.imei1 || "No IMEI recorded"}</code>
                          </div>
                        </div>
                        <span className="tag" style={{ background: "#dbeafe", color: "#1d4ed8", fontWeight: 700, fontSize: "11px" }}>
                          {formatDeviceStatus(selectedDev.status)}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div style={{ marginTop: "14px", display: "grid", gap: "12px" }}>
                <label style={{ fontSize: "11.5px", color: "#475569", fontWeight: 600, display: "grid", gap: "4px" }}>
                  Reported Complaint / Issue *
                  <input
                    required
                    placeholder="e.g. Broken screen display, touch unresponsive, battery drain"
                    value={complaint}
                    onChange={(e) => setComplaint(e.target.value)}
                    style={{
                      height: "38px",
                      border: "1.5px solid #cbd5e1",
                      borderRadius: "8px",
                      padding: "0 10px",
                      fontSize: "12.5px",
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  />
                </label>

                <div className="form-grid">
                  <label style={{ fontSize: "11.5px", color: "#475569", fontWeight: 600, display: "grid", gap: "4px" }}>
                    Repair Priority
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      style={{
                        height: "38px",
                        border: "1.5px solid #cbd5e1",
                        borderRadius: "8px",
                        padding: "0 34px 0 10px",
                        fontSize: "12.5px",
                        background: "#fff",
                        width: "100%",
                        boxSizing: "border-box",
                        cursor: "pointer",
                      }}
                    >
                      <option value="Normal">Normal</option>
                      <option value="Urgent">Urgent (Express)</option>
                      <option value="High">High</option>
                      <option value="Low">Low</option>
                    </select>
                  </label>

                  <label style={{ fontSize: "11.5px", color: "#475569", fontWeight: 600, display: "grid", gap: "4px" }}>
                    Assign Initial Technician
                    <select
                      value={initialTechId}
                      onChange={(e) => setInitialTechId(e.target.value)}
                      style={{
                        width: "100%",
                        height: "38px",
                        border: "1.5px solid #cbd5e1",
                        borderRadius: "8px",
                        padding: "0 34px 0 10px",
                        fontSize: "12px",
                        background: "#fff",
                        boxSizing: "border-box",
                        cursor: "pointer",
                      }}
                    >
                      <option value="">-- Unassigned (Assign Later) --</option>
                      {staffList
                        .filter((s) => (s.role === "technician" || s.role === "owner" || s.role === "workshop_manager") && isStaffMemberActive(s))
                        .map((tech) => (
                          <option key={tech.id} value={tech.id}>
                            {tech.full_name || "Staff"} ({tech.role?.replace(/_/g, " ")})
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <div
              className="modal-actions"
              style={{
                flexShrink: 0,
                marginTop: "12px",
                paddingTop: "12px",
                borderTop: "1px solid #f1f5f9",
                display: "grid",
                gridTemplateColumns: "1fr 2fr",
                gap: "10px",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              <button
                type="button"
                className="secondary-btn"
                style={{ justifyContent: "center", height: "40px", fontSize: "13px", fontWeight: 600 }}
                onClick={() => setShowAddJob(false)}
              >
                Cancel
              </button>
              <button
                className="primary-btn"
                style={{ justifyContent: "center", height: "40px", fontSize: "13px", fontWeight: 700 }}
                disabled={submitting}
              >
                {submitting ? "Opening Ticket..." : "Create Repair Job Card"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: ASSIGN TECHNICIAN WITH SPECIALIZATION */}
      {showAssignTech && selectedJob && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleAssignTech} style={{ maxWidth: "520px" }}>
            <div className="modal-head">
              <div>
                <h2>Assign Technician to Repair</h2>
                <p>
                  Job #{selectedJob.job_number} — {selectedJob.device?.brand} {selectedJob.device?.model}
                </p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowAssignTech(false)}>×</button>
            </div>

            <div style={{ display: "grid", gap: "12px" }}>
              <label style={{ fontSize: "11px", color: "#687b92", display: "grid", gap: "4px" }}>
                Select Workshop Technician:
                <select
                  value={assignTechId}
                  onChange={(e) => setAssignTechId(e.target.value)}
                  style={{ height: "36px", border: "1px solid #e0e7ef", borderRadius: "6px", padding: "0 8px" }}
                >
                  {staffList
                    .filter((s) => (s.role === "technician" || s.role === "owner" || s.role === "workshop_manager") && isStaffMemberActive(s))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name || "Technician"} — Role: {s.role}
                      </option>
                    ))}
                </select>
              </label>

              <label style={{ fontSize: "11px", color: "#687b92", display: "grid", gap: "4px" }}>
                Technician Specialization Domain:
                <select
                  value={selectedSpec}
                  onChange={(e) => {
                    const spec = e.target.value;
                    setSelectedSpec(spec);
                    if (SPECIALIZATION_TASKS[spec]) {
                      setTaskName(SPECIALIZATION_TASKS[spec][0]);
                    }
                  }}
                  style={{ height: "36px", border: "1px solid #e0e7ef", borderRadius: "6px", padding: "0 8px" }}
                >
                  <option value="Display specialist">Display specialist (Screen, OLED, Digitizer)</option>
                  <option value="Motherboard specialist">Motherboard specialist (Micro-soldering, IC, Power)</option>
                  <option value="Software specialist">Software specialist (OS flashing, Bootloop, Unlock)</option>
                  <option value="Camera specialist">Camera specialist (Lenses, Sensors, FaceID)</option>
                  <option value="Hardware specialist">Hardware specialist (Battery, Charging, Speaker, Ports)</option>
                  <option value="General mobile technician">General mobile technician (General servicing)</option>
                </select>
              </label>

              <label style={{ fontSize: "11px", color: "#687b92", display: "grid", gap: "4px" }}>
                Bench Task Assignment:
                <select
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  style={{ height: "36px", border: "1px solid #e0e7ef", borderRadius: "6px", padding: "0 8px" }}
                >
                  {(SPECIALIZATION_TASKS[selectedSpec] || []).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>

              <label style={{ fontSize: "11px", color: "#687b92", display: "grid", gap: "4px" }}>
                Labor Cost Rate (₹):
                <input
                  type="number"
                  min="0"
                  value={laborCost}
                  onChange={(e) => setLaborCost(e.target.value)}
                  style={{ height: "36px", border: "1px solid #e0e7ef", borderRadius: "6px", padding: "0 8px" }}
                />
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setShowAssignTech(false)}>Cancel</button>
              <button className="primary-btn" disabled={submitting}>
                {submitting ? "Assigning..." : "Assign Task & Move to In Repair"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: ISSUE SPARE PART VIA FIFO */}
      {showIssuePart && selectedJob && (() => {
        const selectedPart = parts.find((p) => p.id === partId);
        const availableStock = Number(selectedPart?.quantity ?? selectedPart?.current_stock ?? 0);
        const isOutOfStock = availableStock <= 0;
        const requestedQty = Number(partQty || 1);
        const isOverRequested = requestedQty > availableStock;
        const estCost = requestedQty * Number(selectedPart?.unit_cost || selectedPart?.purchase_price || 0);

        return (
          <div className="modal-backdrop" style={{ zIndex: 120 }}>
            <form
              className="modal"
              onSubmit={handleIssuePart}
              style={{
                maxWidth: "520px",
                width: "100%",
                boxSizing: "border-box",
                overflowX: "hidden",
              }}
            >
              <div className="modal-head">
                <div>
                  <h2>Issue Spare Part (FIFO Stock Deduction)</h2>
                  <p>Allocates FIFO unit cost to Job #{selectedJob.job_number} and decrements stock in real-time.</p>
                </div>
                <button type="button" className="icon-btn" onClick={() => setShowIssuePart(false)}>×</button>
              </div>

              <div style={{ display: "grid", gap: "12px", width: "100%", boxSizing: "border-box", minWidth: 0 }}>
                <label style={{ fontSize: "11px", color: "#687b92", display: "grid", gap: "4px", width: "100%", boxSizing: "border-box", minWidth: 0 }}>
                  Select Spare Part from Catalogue:
                  <select
                    value={partId}
                    onChange={(e) => setPartId(e.target.value)}
                    style={{
                      width: "100%",
                      maxWidth: "100%",
                      boxSizing: "border-box",
                      height: "38px",
                      borderRadius: "8px",
                      fontSize: "12.5px",
                    }}
                  >
                    {parts.map((p) => {
                      const cleanSku = (p.sku || "").replace(/^SKU:\s*/i, "").trim();
                      return (
                        <option key={p.id} value={p.id}>
                          {p.name} ({cleanSku}) — Stock: {p.quantity} units | Cost: ₹{(p.unit_cost || p.purchase_price || 0).toLocaleString("en-IN")}
                        </option>
                      );
                    })}
                  </select>
                </label>

                {selectedPart && (
                  <div style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: isOutOfStock ? "#fff0ef" : "#f0fdf4",
                    border: `1px solid ${isOutOfStock ? "#fecaca" : "#bbf7d0"}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    width: "100%",
                    boxSizing: "border-box",
                    minWidth: 0,
                    fontSize: "12px",
                  }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {selectedPart.name}
                      </div>
                      <div style={{ color: "#64748b", fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        SKU: <code>{(selectedPart.sku || "").replace(/^SKU:\s*/i, "")}</code>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div>Available: <b style={{ color: isOutOfStock ? "#dc2626" : "#16a34a" }}>{availableStock} units</b></div>
                      <div style={{ color: "#64748b", fontSize: "11px" }}>
                        Unit Cost: ₹{Number(selectedPart.unit_cost || selectedPart.purchase_price || 0).toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>
                )}

                <label style={{ fontSize: "11px", color: "#687b92", display: "grid", gap: "4px", width: "100%", boxSizing: "border-box", minWidth: 0 }}>
                  Quantity to Deduct:
                  <input
                    type="number"
                    min="1"
                    max={availableStock > 0 ? availableStock : 1}
                    value={partQty}
                    onChange={(e) => setPartQty(e.target.value)}
                    style={{
                      width: "100%",
                      maxWidth: "100%",
                      boxSizing: "border-box",
                      height: "38px",
                      border: "1.5px solid #cbd5e1",
                      borderRadius: "8px",
                      padding: "0 12px",
                      fontSize: "13px",
                    }}
                  />
                </label>

                {requestedQty > 0 && selectedPart && (
                  <div style={{ fontSize: "12px", color: isOverRequested ? "#dc2626" : "#475569" }}>
                    {isOverRequested ? (
                      <b>⚠️ Cannot issue {requestedQty} units. Only {availableStock} units in stock.</b>
                    ) : (
                      <span>Total Allocation Cost: <b>₹{estCost.toLocaleString("en-IN")}</b></span>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-actions" style={{ width: "100%", boxSizing: "border-box" }}>
                <button type="button" className="secondary-btn" onClick={() => setShowIssuePart(false)}>Cancel</button>
                <button
                  className="primary-btn"
                  disabled={submitting || isOutOfStock || isOverRequested || !partId}
                >
                  {submitting ? "Processing FIFO Issue..." : "Deduct Stock & Allocate Cost"}
                </button>
              </div>
            </form>
          </div>
        );
      })()}

      {/* MODAL: JOB CARD DETAILS & 6-STEP WORKFLOW 360 */}
      {viewJob && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: "760px", width: "95%" }}>
            <div className="modal-head">
              <div>
                <span className="tag" style={{ background: "#edf5fc", color: "#0176d3", fontWeight: 700 }}>
                  Repair Ticket #{viewJob.job_number}
                </span>
                <h2 style={{ marginTop: "6px" }}>
                  {viewJob.device?.brand} {viewJob.device?.model}
                </h2>
                <p>
                  Intake Date: {new Date(viewJob.created_at).toLocaleDateString("en-IN")} | IMEI: <code>{viewJob.device?.imei1 || "N/A"}</code>
                </p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setViewJob(null)}>×</button>
            </div>

            {/* 6-STEP REPAIR WORKFLOW LIFECYCLE CHECKLIST PIPELINE */}
            <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1.5px solid #e2e8f0", marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "6px" }}>
                <span className="checklist-section-title" style={{ margin: 0 }}>
                  <ShieldCheck size={14} /> Repair Lifecycle Workflow Stages
                </span>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#0176d3", background: "#e0f2fe", padding: "2px 8px", borderRadius: "12px" }}>
                  Current Status: {(viewJob.status || "").replace(/_/g, " ").toUpperCase()}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
                  gap: "8px",
                }}
              >
                {[
                  { step: "1", label: "Received", desc: "Handset logged", isDone: true, isCurrent: viewJob.status === "received" },
                  { step: "2", label: "Assigned", desc: "Technician tasked", isDone: viewJob.status !== "received", isCurrent: viewJob.status === "assigned" },
                  { step: "3", label: "In Repair", desc: "Bench servicing", isDone: viewJob.status === "in_progress" || viewJob.status === "qc_pending" || viewJob.status === "completed", isCurrent: viewJob.status === "in_progress" },
                  { step: "4", label: "QC Gate", desc: "Pre-release audit", isDone: viewJob.status === "qc_pending" || viewJob.status === "completed", isCurrent: viewJob.status === "qc_pending" },
                  { step: "5", label: "Completed", desc: "Ready for pickup", isDone: viewJob.status === "completed", isCurrent: viewJob.status === "completed" },
                  { step: "6", label: "Delivered", desc: "Customer handover", isDone: viewJob.status === "completed", isCurrent: false },
                ].map((s) => {
                  const stateClass = s.isCurrent ? "is-pending" : s.isDone ? "is-passed" : "";
                  return (
                    <div
                      key={s.step}
                      className={`checklist-card ${stateClass}`}
                      style={{
                        padding: "10px 6px",
                        flexDirection: "column",
                        gap: "6px",
                        alignItems: "center",
                        textAlign: "center",
                        minHeight: "72px",
                        cursor: "default",
                      }}
                    >
                      <div
                        className="checklist-indicator"
                        style={{
                          margin: 0,
                          width: "20px",
                          height: "20px",
                          background: s.isCurrent ? "#0176d3" : s.isDone ? "#16a34a" : "#fff",
                          borderColor: s.isCurrent ? "#0176d3" : s.isDone ? "#16a34a" : "#cbd5e1",
                          color: s.isCurrent || s.isDone ? "#fff" : "#94a3b8",
                          fontSize: "10px",
                          fontWeight: 700,
                        }}
                      >
                        {s.isDone && !s.isCurrent ? <Check size={12} strokeWidth={3} /> : s.step}
                      </div>

                      <div style={{ width: "100%" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: s.isCurrent ? "#0176d3" : s.isDone ? "#0f172a" : "#94a3b8" }}>
                          {s.label}
                        </div>
                        <div style={{ fontSize: "9px", color: s.isCurrent ? "#0284c7" : "#64748b", marginTop: "1px" }}>
                          {s.desc}
                        </div>
                      </div>

                      <span
                        className={`checklist-tag ${s.isCurrent ? "pending" : s.isDone ? "pass" : ""}`}
                        style={{
                          fontSize: "8.5px",
                          padding: "1px 6px",
                          background: s.isCurrent ? "#e0f2fe" : s.isDone ? "#dcfce7" : "#f1f5f9",
                          color: s.isCurrent ? "#0369a1" : s.isDone ? "#15803d" : "#94a3b8",
                          borderColor: s.isCurrent ? "#bae6fd" : s.isDone ? "#bbf7d0" : "#e2e8f0",
                        }}
                      >
                        {s.isCurrent ? "ACTIVE" : s.isDone ? "DONE" : "PENDING"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TOTAL REPAIR COST ROLLUP */}
            {(() => {
              const totalPartsCost = viewIssuedParts.reduce((sum, p) => sum + (p.quantity * p.unit_cost), 0);
              const totalLaborCost = Number(viewJob.actual_labor_cost || 0);
              const grandTotalCost = totalPartsCost + totalLaborCost;

              return (
                <div className="responsive-grid-3" style={{ gap: "10px", background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e7edf5", marginBottom: "16px" }}>
                  <div>
                    <small style={{ color: "#8291a5", fontSize: "10px" }}>Spare Parts (FIFO Allocated)</small>
                    <b style={{ display: "block", fontSize: "16px", color: "#15945b" }}>₹{totalPartsCost.toLocaleString("en-IN")}</b>
                  </div>
                  <div>
                    <small style={{ color: "#8291a5", fontSize: "10px" }}>Technician Labor Cost</small>
                    <b style={{ display: "block", fontSize: "16px", color: "#7955c7" }}>₹{totalLaborCost.toLocaleString("en-IN")}</b>
                  </div>
                  <div>
                    <small style={{ color: "#8291a5", fontSize: "10px" }}>Total Repair Cost</small>
                    <b style={{ display: "block", fontSize: "16px", color: "#0176d3" }}>₹{grandTotalCost.toLocaleString("en-IN")}</b>
                  </div>
                </div>
              );
            })()}

            {/* Complaint & Technical Diagnosis */}
            <div style={{ display: "grid", gap: "10px", marginBottom: "16px" }}>
              <div style={{ background: "#fff", border: "1px solid #e0e7ef", borderRadius: "8px", padding: "12px" }}>
                <b style={{ fontSize: "11px", color: "#152b49", display: "block", marginBottom: "4px" }}>
                  Reported Issue / Complaint:
                </b>
                <p style={{ margin: 0, fontSize: "12px", color: "#334155" }}>
                  {viewJob.complaint || viewJob.title}
                </p>
              </div>

              {viewJob.diagnosis && (
                <div style={{ background: "#edf5fc", border: "1px solid #cfe2f7", borderRadius: "8px", padding: "12px" }}>
                  <b style={{ fontSize: "11px", color: "#0176d3", display: "block", marginBottom: "4px" }}>
                    Technician Diagnosis & Action Steps:
                  </b>
                  <p style={{ margin: 0, fontSize: "12px", color: "#152b49" }}>{viewJob.diagnosis}</p>
                </div>
              )}
            </div>

            {/* Assigned Technicians */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#152b49", marginBottom: "8px" }}>
                Assigned Technician Bench Tasks ({(viewJob.assignments || []).length})
              </div>
              {(viewJob.assignments || []).length === 0 ? (
                <div className="empty" style={{ padding: "14px" }}>
                  No technicians currently assigned to this repair.
                </div>
              ) : (
                <div style={{ display: "grid", gap: "6px" }}>
                  {viewJob.assignments?.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 12px",
                        background: "#f1edff",
                        borderRadius: "6px",
                      }}
                    >
                      <div>
                        <b style={{ fontSize: "12px", color: "#7955c7" }}>{a.task_name}</b>
                        <div style={{ fontSize: "10px", color: "#64748b" }}>
                          Assigned: {a.assigned_at ? new Date(a.assigned_at).toLocaleString("en-IN") : "—"}
                        </div>
                      </div>
                      <span className="tag" style={{ background: "#fff", fontWeight: 700, color: "#7955c7" }}>
                        Assigned
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Spare Parts Issued via FIFO */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#152b49" }}>
                  Spare Parts Consumed via FIFO ({viewIssuedParts.length})
                </div>
                <button
                  type="button"
                  className="secondary-btn"
                  style={{
                    padding: "4px 10px",
                    fontSize: "11px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    color: "#0176d3",
                    borderColor: "#b9dcfa",
                    background: "#f0f7ff",
                    fontWeight: 600,
                  }}
                  onClick={() => {
                    setSelectedJob(viewJob);
                    const availablePart = parts.find((p) => (p.quantity || p.current_stock || 0) > 0) || parts[0];
                    setPartId(availablePart?.id || "");
                    setPartQty("1");
                    setShowIssuePart(true);
                  }}
                >
                  <Wrench size={12} /> + Issue Spare Part
                </button>
              </div>
              {loadingParts ? (
                <div className="empty">Loading parts issued…</div>
              ) : viewIssuedParts.length === 0 ? (
                <div className="empty" style={{ padding: "16px", textAlign: "center" }}>
                  <p style={{ margin: "0 0 10px 0", color: "#64748b", fontSize: "12px" }}>
                    No spare parts issued to this repair job yet.
                  </p>
                  <button
                    type="button"
                    className="primary-btn"
                    style={{ padding: "6px 14px", fontSize: "11.5px", display: "inline-flex", alignItems: "center", gap: "6px", margin: "0 auto" }}
                    onClick={() => {
                      setSelectedJob(viewJob);
                      const availablePart = parts.find((p) => (p.quantity || p.current_stock || 0) > 0) || parts[0];
                      setPartId(availablePart?.id || "");
                      setPartQty("1");
                      setShowIssuePart(true);
                    }}
                  >
                    <Wrench size={13} /> Issue Spare Part (FIFO Stock Deduction)
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gap: "6px" }}>
                  {viewIssuedParts.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 12px",
                        background: "#e8f8f0",
                        borderRadius: "6px",
                      }}
                    >
                      <div>
                        <b style={{ fontSize: "12px", color: "#15945b" }}>
                          {p.part_name} (<code>{p.sku}</code>)
                        </b>
                        <div style={{ fontSize: "10px", color: "#64748b" }}>
                          Quantity: {p.quantity} unit(s) @ ₹{p.unit_cost}/unit
                        </div>
                      </div>
                      <span className="tag" style={{ background: "#fff", fontWeight: 700, color: "#15945b" }}>
                        FIFO Cost: ₹{(p.quantity * p.unit_cost).toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button type="button" className="primary-btn" onClick={() => setViewJob(null)}>
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
