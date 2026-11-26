import React, { useState, useEffect, useMemo } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Wrench,
  Check,
  X as XIcon,
  Eye,
} from "lucide-react";
import { getQcChecks, recordQcCheck, getDevices, getJobCards, normalizeDeviceStatus, formatDeviceStatus } from "../lib/repairs";
import type { QcCheck, Device, Job } from "../lib/types";
import { ChecklistCard, ChecklistToolbar } from "../components/ChecklistCard";
import CustomSelect from "../components/CustomSelect";

const qcCheckItems = [
  { key: "screen_touch", label: "Display & Touch Calibration", desc: "No dead pixels, uniform backlighting, multi-touch responsive across all corners", category: "Display & Digitizer", failReason: "Display touch uncalibrated / ghost touch" },
  { key: "battery_charge", label: "Battery & Charging IC", desc: "Fast charges without loose port, no excessive thermal heat, battery health verified", category: "Power & Thermal", failReason: "Battery drain test failed" },
  { key: "cameras_sensors", label: "Cameras & Biometric Sensors", desc: "Autofocus crisp, Face ID / fingerprint unlocks immediately, flash functional", category: "Sensors & Optics", failReason: "Camera lens dust / focus issue" },
  { key: "audio_mic", label: "Loudspeaker, Earpiece & Mic", desc: "Stereo speaker clean audio, earpiece clear on call, dual mic noise cancel works", category: "Audio & Acoustics", failReason: "Earpiece distortion at high volume" },
  { key: "network_rf", label: "Cellular, Wi-Fi & Bluetooth", desc: "SIM network registers, 4G/5G data transmits, Wi-Fi 2.4/5GHz links reliably", category: "Wireless & Network", failReason: "Cellular / Wi-Fi antenna reception weak" },
  { key: "assembly_clean", label: "Physical Assembly & Cleaning", desc: "All internal screws secured, display adhesive cured, external chassis sanitized", category: "Chassis & Final QC", failReason: "Excess glue / cosmetic defect on bezel" },
];

export default function QualityControlPage() {
  const [qcList, setQcList] = useState<QcCheck[]>([]);
  const [qcEligibleDevices, setQcEligibleDevices] = useState<Device[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterVerdict, setFilterVerdict] = useState<"all" | "passed" | "rework" | "awaiting">("all");

  // Modal & Checklist State
  const [showModal, setShowModal] = useState(false);
  const [selectedQcForView, setSelectedQcForView] = useState<QcCheck | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [passed, setPassed] = useState(true);
  const [failureReason, setFailureReason] = useState("");
  const [reworkNotes, setReworkNotes] = useState("");

  const [qcChecklist, setQcChecklist] = useState<Record<string, boolean>>({
    screen_touch: true,
    battery_charge: true,
    cameras_sensors: true,
    audio_mic: true,
    network_rf: true,
    assembly_clean: true,
  });

  const [submitting, setSubmitting] = useState(false);

  function toggleQcCheck(key: string) {
    const nextVal = !qcChecklist[key];
    const updated = { ...qcChecklist, [key]: nextVal };
    setQcChecklist(updated);

    const allPassed = Object.values(updated).every(Boolean);
    if (!allPassed) {
      setPassed(false);
      const firstFailed = qcCheckItems.find((item) => updated[item.key] === false);
      if (firstFailed) {
        setFailureReason(firstFailed.failReason);
      }
    } else {
      setPassed(true);
      setFailureReason("");
    }
  }

  function handlePassAllQc() {
    const allTrue: Record<string, boolean> = {};
    qcCheckItems.forEach((item) => (allTrue[item.key] = true));
    setQcChecklist(allTrue);
    setPassed(true);
    setFailureReason("");
  }

  function handleFailAllQc() {
    const allFalse: Record<string, boolean> = {};
    qcCheckItems.forEach((item) => (allFalse[item.key] = false));
    setQcChecklist(allFalse);
    setPassed(false);
    setFailureReason(qcCheckItems[0].failReason);
  }

  const totalQcItems = qcCheckItems.length;
  const passedQcCount = Object.values(qcChecklist).filter(Boolean).length;
  const defectQcCount = totalQcItems - passedQcCount;

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [allQc, allDevs, allJobs] = await Promise.all([
        getQcChecks(),
        getDevices(),
        getJobCards(),
      ]);
      setQcList(allQc);
      // Devices under repair or intake eligible for QC inspection
      setQcEligibleDevices(allDevs.filter((d) => {
        const st = normalizeDeviceStatus(d.status);
        return st !== "ready_for_sale" && st !== "scrapped" && st !== "sold";
      }));
      setJobs(allJobs);
    } catch (err: any) {
      setError(err?.message || "Failed to load QC records");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredQcList = useMemo(() => {
    if (filterVerdict === "passed") return qcList.filter((q) => q.is_passed);
    if (filterVerdict === "rework") return qcList.filter((q) => !q.is_passed);
    return qcList;
  }, [qcList, filterVerdict]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (!selectedDeviceId) {
        throw new Error("Please select a target handset to inspect.");
      }
      if (!passed && !failureReason.trim()) {
        throw new Error("Failure reason is mandatory when rejecting QC.");
      }

      await recordQcCheck(
        selectedDeviceId,
        selectedJobId || null,
        passed,
        failureReason,
        reworkNotes
      );

      setShowModal(false);
      setSuccess(
        passed
          ? "QC Approved: Repair verified. Handset marked Ready for Handover."
          : "QC Rejected: Rework requirements logged. Device returned to Repair bench."
      );
      setFailureReason("");
      setReworkNotes("");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to record QC check");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">FINAL VERIFICATION & RELEASE</div>
          <h1>Quality Control & Release Gate</h1>
          <p>Rigorous multi-point testing, rework routing, and gating devices before final repair handover.</p>
        </div>
        <div>
          <button className="primary-btn" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Perform QC Verification
          </button>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}
      {success && (
        <div className="notice" style={{ background: "#e8f8f0", color: "#15945b", display: "flex", gap: "8px", alignItems: "center" }}>
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {/* QC Summary Metrics (Clickable Interactive Cards) */}
      <div className="stats-grid">
        <div
          className={`stat-card clickable ${filterVerdict === "all" ? "active" : ""}`}
          onClick={() => setFilterVerdict("all")}
          style={{ cursor: "pointer", position: "relative" }}
          title="Click to view all QC audits"
        >
          <div className="stat-icon Blue"><ShieldCheck size={20} /></div>
          <div className="stat-label">Total QC Checks</div>
          <div className="stat-value">{qcList.length}</div>
          <div className="stat-foot">Lifetime inspections</div>
        </div>

        <div
          className={`stat-card clickable ${filterVerdict === "passed" ? "active" : ""}`}
          onClick={() => setFilterVerdict(filterVerdict === "passed" ? "all" : "passed")}
          style={{ cursor: "pointer", position: "relative" }}
          title="Click to filter passed QC audits"
        >
          <div className="stat-icon Green"><CheckCircle2 size={20} /></div>
          <div className="stat-label">QC Passed (Ready for Handover)</div>
          <div className="stat-value" style={{ color: "#15945b" }}>
            {qcList.filter((q) => q.is_passed).length}
          </div>
          <div className="stat-foot">Approved devices</div>
        </div>

        <div
          className={`stat-card clickable ${filterVerdict === "rework" ? "active" : ""}`}
          onClick={() => setFilterVerdict(filterVerdict === "rework" ? "all" : "rework")}
          style={{ cursor: "pointer", position: "relative" }}
          title="Click to filter rework required audits"
        >
          <div className="stat-icon Orange"><AlertTriangle size={20} /></div>
          <div className="stat-label">Rework Required</div>
          <div className="stat-value" style={{ color: "#b42318" }}>
            {qcList.filter((q) => !q.is_passed).length}
          </div>
          <div className="stat-foot">Returned to technicians</div>
        </div>

        <div
          className={`stat-card clickable ${filterVerdict === "awaiting" ? "active" : ""}`}
          onClick={() => setFilterVerdict(filterVerdict === "awaiting" ? "all" : "awaiting")}
          style={{ cursor: "pointer", position: "relative" }}
          title="Click to view handsets awaiting QC inspection"
        >
          <div className="stat-icon Purple"><Smartphone size={20} /></div>
          <div className="stat-label">Devices Awaiting QC</div>
          <div className="stat-value">{qcEligibleDevices.length}</div>
          <div className="stat-foot">Currently pending audit</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button className="icon-btn" onClick={loadData} title="Refresh">
              <RefreshCw size={16} />
            </button>
            <span className="count">
              {filterVerdict === "awaiting"
                ? `${qcEligibleDevices.length} devices awaiting QC audit`
                : `${filteredQcList.length} of ${qcList.length} QC audits logged`}
            </span>
          </div>
          {filterVerdict !== "all" && (
            <button
              className="secondary-btn"
              style={{ padding: "4px 10px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
              onClick={() => setFilterVerdict("all")}
            >
              Reset Filter (Show All)
            </button>
          )}
        </div>

        <div className="table-wrap desktop-qc-table">
          <table>
            <thead>
              {filterVerdict === "awaiting" ? (
                <tr>
                  <th>Handset Model & Brand</th>
                  <th>IMEI / Serial</th>
                  <th>Workshop Status</th>
                  <th>Intake Condition</th>
                  <th>Storage & Color</th>
                  <th>Device ID</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              ) : (
                <tr>
                  <th>Audit Timestamp</th>
                  <th>Device ID</th>
                  <th>QC Verdict</th>
                  <th>Failure Reason</th>
                  <th>Rework Instructions</th>
                  <th>Linked Job Card</th>
                  <th style={{ textAlign: "right" }}>QC Audit</th>
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="empty">Loading QC records…</td>
                </tr>
              ) : filterVerdict === "awaiting" ? (
                qcEligibleDevices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty">No devices currently awaiting QC inspection.</td>
                  </tr>
                ) : (
                  qcEligibleDevices.map((d) => (
                    <tr key={d.id}>
                      <td><b>{d.brand} {d.model}</b></td>
                      <td><code>{d.imei || "—"}</code></td>
                      <td><span className="tag">{formatDeviceStatus(d.status)}</span></td>
                      <td>{d.condition_grade ? `Grade ${d.condition_grade}` : "Standard Intake"}</td>
                      <td>{d.storage_capacity ? `${d.storage_capacity} • ${d.color || "Default"}` : "—"}</td>
                      <td><code>#{d.id.slice(0, 8)}</code></td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="primary-btn"
                          style={{ padding: "4px 10px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          onClick={() => {
                            setSelectedDeviceId(d.id);
                            setShowModal(true);
                          }}
                        >
                          <ShieldCheck size={12} /> Audit Handset
                        </button>
                      </td>
                    </tr>
                  ))
                )
              ) : filteredQcList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">
                    {filterVerdict === "passed"
                      ? "No QC passed records found for current filter."
                      : filterVerdict === "rework"
                      ? "No rework required records found for current filter."
                      : "No QC checks performed yet. Click \"Perform QC Verification\" to start."}
                  </td>
                </tr>
              ) : (
                filteredQcList.map((q) => (
                  <tr key={q.id}>
                    <td>{new Date(q.checked_at).toLocaleString("en-IN")}</td>
                    <td><code>{q.device_id.slice(0, 13)}...</code></td>
                    <td>
                      {q.is_passed ? (
                        <span className="tag" style={{ background: "#e8f8f0", color: "#15945b", fontWeight: 700 }}>
                          <Check size={11} style={{ display: "inline", marginRight: 3 }} /> PASSED
                        </span>
                      ) : (
                        <span className="tag" style={{ background: "#fff0ef", color: "#b42318", fontWeight: 700 }}>
                          <XIcon size={11} style={{ display: "inline", marginRight: 3 }} /> REWORK REQUIRED
                        </span>
                      )}
                    </td>
                    <td><b>{q.failure_reason || "None — Passed all tests"}</b></td>
                    <td style={{ maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {q.rework_notes || "—"}
                    </td>
                    <td>
                      {q.job_card_id ? <code>#{q.job_card_id.slice(0, 8)}</code> : "Direct Release"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="secondary-btn"
                        style={{ padding: "4px 8px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        onClick={() => setSelectedQcForView(q)}
                        title="View QC audit verification details"
                      >
                        <Eye size={12} /> View Audit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Touch Cards */}
        <div className="mobile-qc-cards">
          {filterVerdict === "awaiting" ? (
            qcEligibleDevices.length === 0 ? (
              <div style={{ textAlign: "center", color: "#64748b", padding: "20px" }}>
                No devices currently awaiting QC inspection.
              </div>
            ) : (
              qcEligibleDevices.map((d) => (
                <div key={d.id} className="mobile-qc-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <b style={{ fontSize: "13px" }}>{d.brand} {d.model}</b>
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                        IMEI: {d.imei || "—"}
                      </div>
                    </div>
                    <span className="tag">{formatDeviceStatus(d.status)}</span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#475569", marginTop: "6px" }}>
                    {d.storage_capacity} {d.color}
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                    <button
                      type="button"
                      className="primary-btn"
                      style={{ padding: "6px 12px", fontSize: "11.5px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                      onClick={() => {
                        setSelectedDeviceId(d.id);
                        setShowModal(true);
                      }}
                    >
                      <ShieldCheck size={13} /> Audit Handset
                    </button>
                  </div>
                </div>
              ))
            )
          ) : filteredQcList.length === 0 ? (
            <div style={{ textAlign: "center", color: "#64748b", padding: "20px" }}>
              {filterVerdict === "passed"
                ? "No QC passed records found."
                : filterVerdict === "rework"
                ? "No rework required records found."
                : "No QC checks performed yet. Tap \"Perform QC Verification\" to start."}
            </div>
          ) : (
            filteredQcList.map((q) => (
              <div key={q.id} className="mobile-qc-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    {q.is_passed ? (
                      <span className="tag" style={{ background: "#e8f8f0", color: "#15945b", fontWeight: 700 }}>
                        <Check size={11} style={{ display: "inline", marginRight: 3 }} /> PASSED
                      </span>
                    ) : (
                      <span className="tag" style={{ background: "#fff0ef", color: "#b42318", fontWeight: 700 }}>
                        <XIcon size={11} style={{ display: "inline", marginRight: 3 }} /> REWORK REQUIRED
                      </span>
                    )}
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                      {new Date(q.checked_at).toLocaleString("en-IN")}
                    </div>
                  </div>
                  <span className="tag" style={{ background: "#f1f5f9", color: "#475569", fontWeight: 600 }}>
                    {q.job_card_id ? `Job #${q.job_card_id.slice(0, 8)}` : "Direct Release"}
                  </span>
                </div>

                <div style={{ fontSize: "12px", color: "#334155" }}>
                  <b>Device:</b> <code>{q.device_id.slice(0, 16)}...</code>
                </div>

                {!q.is_passed && q.failure_reason && (
                  <div style={{ background: "#fef2f2", borderLeft: "3px solid #b42318", padding: "6px 8px", borderRadius: "4px", fontSize: "11.5px", color: "#991b1b" }}>
                    <b>Failure:</b> {q.failure_reason}
                  </div>
                )}

                {q.rework_notes && (
                  <div style={{ fontSize: "11.5px", color: "#475569" }}>
                    <b>Instructions:</b> {q.rework_notes}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
                  <button
                    type="button"
                    className="secondary-btn"
                    style={{ padding: "6px 12px", fontSize: "11.5px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                    onClick={() => setSelectedQcForView(q)}
                  >
                    <Eye size={13} /> View Audit
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MODAL: PERFORM QC CHECK */}
      {showModal && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={handleSubmit} style={{ width: "min(640px, 95%)", maxWidth: "640px" }}>
            <div className="modal-head">
              <div>
                <h2>Quality Control Verification</h2>
                <p>Approve handset for sale or assign rework to technicians</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowModal(false)}>×</button>
            </div>

            <div className="form-grid">
              <label style={{ gridColumn: "1 / -1", display: "grid", gap: "7px" }}>
                Target Handset *
                <CustomSelect
                  value={selectedDeviceId}
                  onChange={(val) => setSelectedDeviceId(val)}
                  placeholder="-- Choose Handset to Inspect --"
                  options={[
                    { value: "", label: "-- Choose Handset to Inspect --" },
                    ...qcEligibleDevices.map((d) => ({
                      value: d.id,
                      label: `${d.brand} ${d.model} (${d.imei1 ? `IMEI: ${d.imei1}` : "No IMEI"}) — ${formatDeviceStatus(d.status)}`,
                    })),
                  ]}
                  style={{ width: "100%" }}
                  minWidth="100%"
                  height="38px"
                />
              </label>

              <label style={{ gridColumn: "1 / -1", display: "grid", gap: "7px" }}>
                Linked Repair Job Card (Optional)
                <CustomSelect
                  value={selectedJobId}
                  onChange={(val) => setSelectedJobId(val)}
                  placeholder="-- None / Standalone QC --"
                  options={[
                    { value: "", label: "-- None / Standalone QC --" },
                    ...jobs.map((j) => ({
                      value: j.id,
                      label: `Job #${j.job_number} — ${j.title} (${j.device?.brand || ""} ${j.device?.model || ""})`,
                    })),
                  ]}
                  style={{ width: "100%" }}
                  minWidth="100%"
                  height="38px"
                />
              </label>

              {/* 6-POINT QC MULTI-POINT VERIFICATION CHECKLIST */}
              <div style={{ gridColumn: "1 / -1", marginTop: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span className="checklist-section-title">
                    <ShieldCheck size={14} /> 6-Point Pre-Release QC Verification Checklist
                  </span>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    Tap card to test pass / rework
                  </span>
                </div>

                <ChecklistToolbar
                  totalCount={totalQcItems}
                  passedCount={passedQcCount}
                  defectCount={defectQcCount}
                  onPassAll={handlePassAllQc}
                  onClearAll={handleFailAllQc}
                  passAllText="Pass All Checks"
                  clearAllText="Flag Rework Needed"
                  label="QC Test Coverage"
                />

                <div
                  className="checklist-grid grid-2-col"
                  style={{
                    marginTop: "10px",
                    maxHeight: "300px",
                    overflowY: "auto",
                    paddingRight: "4px",
                  }}
                >
                  {qcCheckItems.map(({ key, label, desc, category }) => {
                    const isPassed = qcChecklist[key] !== false;
                    return (
                      <ChecklistCard
                        key={key}
                        id={key}
                        label={label}
                        desc={desc}
                        category={category}
                        passed={isPassed}
                        onToggle={() => toggleQcCheck(key)}
                        passLabel="VERIFIED"
                        defectLabel="REWORK"
                      />
                    );
                  })}
                </div>
              </div>

              <label style={{ gridColumn: "1 / -1", marginTop: "6px" }}>
                QC Final Verdict *
                <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "6px",
                      border: `2px solid ${passed ? "#15945b" : "#e2e8f0"}`,
                      background: passed ? "#e8f8f0" : "#fff",
                      color: passed ? "#15945b" : "#64748b",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                    onClick={handlePassAllQc}
                  >
                    ✓ Pass QC (Ready for Handover)
                  </button>

                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "6px",
                      border: `2px solid ${!passed ? "#b42318" : "#e2e8f0"}`,
                      background: !passed ? "#fff0ef" : "#fff",
                      color: !passed ? "#b42318" : "#64748b",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setPassed(false);
                      if (!failureReason) setFailureReason(qcCheckItems[0].failReason);
                    }}
                  >
                    ✗ Fail QC (Rework Required)
                  </button>
                </div>
              </label>
            </div>

            {!passed && (
              <div style={{ marginTop: "12px", display: "grid", gap: "10px" }}>
                <label style={{ fontSize: "10px", color: "#687b92", display: "grid", gap: "7px" }}>
                  Failure Reason *
                  <CustomSelect
                    value={failureReason}
                    onChange={(val) => setFailureReason(val)}
                    placeholder="-- Choose Primary Failure Reason --"
                    options={[
                      { value: "", label: "-- Choose Primary Failure Reason --" },
                      "Display touch uncalibrated / ghost touch",
                      "Battery drain test failed",
                      "Earpiece distortion at high volume",
                      "Camera lens dust / focus issue",
                      "Microphone sensitivity low",
                      "Excess glue / cosmetic defect on bezel",
                      "Biometrics / Face ID not functional",
                      "Cellular / Wi-Fi antenna reception weak",
                    ]}
                    style={{ width: "100%" }}
                    minWidth="100%"
                    height="38px"
                  />
                </label>

                <label style={{ fontSize: "10px", color: "#687b92", display: "grid", gap: "4px" }}>
                  Rework Instructions for Technician *
                  <textarea
                    rows={2}
                    required
                    placeholder="Specific rework instructions to fix before re-submitting to QC..."
                    value={reworkNotes}
                    onChange={(e) => setReworkNotes(e.target.value)}
                    style={{ border: "1px solid #e0e7ef", borderRadius: "6px", padding: "8px", font: "inherit", fontSize: "11px" }}
                  />
                </label>
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: "16px" }}>
              <button type="button" className="secondary-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="primary-btn" disabled={submitting || !selectedDeviceId}>
                {submitting ? "Submitting..." : passed ? "Approve QC & Mark Ready" : "Reject & Assign Rework"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: VIEW QC AUDIT DETAILS */}
      {selectedQcForView && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: "680px", width: "95%" }}>
            <div className="modal-head">
              <div>
                <span className="tag" style={{ background: selectedQcForView.is_passed ? "#e8f8f0" : "#fee2e2", color: selectedQcForView.is_passed ? "#15945b" : "#b42318", fontWeight: 700 }}>
                  {selectedQcForView.is_passed ? "QC Approved Release" : "QC Rework Required"}
                </span>
                <h2 style={{ marginTop: "6px" }}>
                  Quality Control Verification Audit
                </h2>
                <p>
                  Audit Date: {new Date(selectedQcForView.checked_at).toLocaleString("en-IN")} | Device ID: <code>{selectedQcForView.device_id.slice(0, 16)}...</code>
                </p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setSelectedQcForView(null)}>×</button>
            </div>

            {/* VERDICT SUMMARY */}
            <div style={{ marginBottom: "14px" }}>
              {selectedQcForView.is_passed ? (
                <div style={{ padding: "12px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <CheckCircle2 size={18} style={{ color: "#16a34a", flexShrink: 0 }} />
                  <div>
                    <b style={{ color: "#15803d", fontSize: "13px" }}>Device Passed All QC Gate Criteria</b>
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#166534" }}>
                      Handset verified clean, all hardware functions operational, and approved for customer handover.
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ padding: "12px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <AlertTriangle size={18} style={{ color: "#dc2626", flexShrink: 0 }} />
                    <b style={{ color: "#991b1b", fontSize: "13px" }}>
                      Rework Required: {selectedQcForView.failure_reason || "Check failure"}
                    </b>
                  </div>
                  {selectedQcForView.rework_notes && (
                    <p style={{ margin: 0, fontSize: "12px", color: "#7f1d1d" }}>
                      <b>Bench Instructions:</b> {selectedQcForView.rework_notes}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 6-POINT CHECKLIST BREAKDOWN */}
            <div>
              <div className="checklist-section-title" style={{ marginBottom: "8px" }}>
                <ShieldCheck size={14} /> 6-Point QC Checkpoints:
              </div>
              <div className="checklist-grid grid-2-col" style={{ maxHeight: "300px", overflowY: "auto", paddingRight: "4px" }}>
                {qcCheckItems.map(({ key, label, desc, category, failReason }) => {
                  const itemPassed = selectedQcForView.is_passed || selectedQcForView.failure_reason !== failReason;
                  return (
                    <ChecklistCard
                      key={key}
                      id={key}
                      label={label}
                      desc={desc}
                      category={category}
                      passed={itemPassed}
                      readOnly={true}
                      passLabel="VERIFIED"
                      defectLabel="FLAGGED"
                    />
                  );
                })}
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: "16px" }}>
              <button type="button" className="secondary-btn" onClick={() => setSelectedQcForView(null)}>
                Close QC Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
