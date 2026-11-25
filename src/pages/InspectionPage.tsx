import React, { useState, useEffect } from "react";
import {
  CheckSquare,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Plus,
  Eye,
  ShieldCheck,
  Check,
  X,
} from "lucide-react";
import { getDevices, recordInspection, getInspections, normalizeDeviceStatus, formatDeviceStatus } from "../lib/repairs";
import type { Device, Inspection } from "../lib/types";
import { ChecklistCard, ChecklistToolbar } from "../components/ChecklistCard";

export default function InspectionPage() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [eligibleDevices, setEligibleDevices] = useState<Device[]>([]);
  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal & View Details State
  const [showModal, setShowModal] = useState(false);
  const [selectedInspectionForView, setSelectedInspectionForView] = useState<Inspection | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [grade, setGrade] = useState("Good");
  const [notes, setNotes] = useState("");

  // Systematic 8-Point Hardware Checklist state (true = passed, false = defect)
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    screen: true,
    body: true,
    battery: true,
    camera: true,
    speaker: true,
    charging: true,
    network: true,
    other_issues: true,
  });

  const [submitting, setSubmitting] = useState(false);

  function handlePassAllChecks() {
    setChecklist({
      screen: true,
      body: true,
      battery: true,
      camera: true,
      speaker: true,
      charging: true,
      network: true,
      other_issues: true,
    });
  }

  function handleClearAllChecks() {
    setChecklist({
      screen: false,
      body: false,
      battery: false,
      camera: false,
      speaker: false,
      charging: false,
      network: false,
      other_issues: false,
    });
  }

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [inspList, devList] = await Promise.all([
        getInspections(),
        getDevices(),
      ]);
      setInspections(inspList);
      setAllDevices(devList);
      setEligibleDevices(
        devList.filter((d) => {
          const st = normalizeDeviceStatus(d.status);
          return st !== "ready_for_sale" && st !== "sold";
        })
      );
    } catch (err: any) {
      setError(err?.message || "Failed to load inspections");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function toggleCheck(key: string) {
    setChecklist({ ...checklist, [key]: !checklist[key] });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDeviceId) {
      setError("Please select a target phone to inspect.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Collect failed checks as defects
      const defects: string[] = [];
      Object.entries(checklist).forEach(([k, passed]) => {
        if (!passed) {
          defects.push(k.replace(/_/g, " ").toUpperCase());
        }
      });

      await recordInspection(selectedDeviceId, checklist, defects, grade, notes);
      setShowModal(false);
      setSuccess(`Intake inspection recorded. ${defects.length} defect(s) detected and routed to repair.`);
      setNotes("");
      setSelectedDeviceId("");
      // Reset checklist
      setChecklist({
        screen: true,
        body: true,
        battery: true,
        camera: true,
        speaker: true,
        charging: true,
        network: true,
        other_issues: true,
      });
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to record inspection");
    } finally {
      setSubmitting(false);
    }
  }

  const checkItems = [
    { key: "screen", label: "Screen & Touch Condition", desc: "No glass cracks, touch unresponsive spots, OLED lines, or flickering", category: "Display & Touch" },
    { key: "body", label: "Body & Chassis Housing", desc: "No severe bends, frame dents, cracked back cover, or missing buttons", category: "Chassis & Frame" },
    { key: "battery", label: "Battery Performance", desc: "Holds charge properly, no thermal overheating or battery pouch swelling", category: "Power & Battery" },
    { key: "charging", label: "Charging Port & Power IC", desc: "Connector pins intact, draws standard current without loose connection", category: "Power & Battery" },
    { key: "camera", label: "Front & Rear Cameras", desc: "Camera autofocus operates cleanly, no lens dust, FaceID/flash operational", category: "Optics & Camera" },
    { key: "speaker", label: "Speaker, Earpiece & Mic", desc: "Loudspeaker clean audio output, earpiece clear, microphone recording functional", category: "Sound & Audio" },
    { key: "network", label: "Network & Connectivity", desc: "SIM slot detects cellular networks, Wi-Fi antenna and Bluetooth link operational", category: "Wireless & RF" },
    { key: "other_issues", label: "Other Hardware / Liquid", desc: "Liquid contact indicator not tripped, haptic motor works, logic board stable", category: "Logic & Liquid" },
  ];

  const totalChecklistItems = checkItems.length;
  const passedChecklistCount = Object.values(checklist).filter(Boolean).length;
  const defectChecklistCount = totalChecklistItems - passedChecklistCount;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">DIAGNOSTICS & INTAKE</div>
          <h1>Hardware Intake Inspections</h1>
          <p>Standardized 8-point hardware diagnostic checklist, condition grading, and repair defect tracking.</p>
        </div>
        <div>
          <button className="primary-btn" onClick={() => setShowModal(true)}>
            <Plus size={16} /> New Phone Inspection
          </button>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}
      {success && (
        <div className="notice" style={{ background: "#e8f8f0", color: "#15945b", display: "flex", gap: "8px", alignItems: "center" }}>
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      <div className="panel">
        <div className="panel-toolbar">
          <button className="icon-btn" onClick={loadData} title="Refresh">
            <RefreshCw size={16} />
          </button>
          <span className="count">{inspections.length} recorded diagnostic inspections</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Inspection Date</th>
                <th>Target Phone</th>
                <th>Condition Grade</th>
                <th>Defects Detected</th>
                <th>Technical Notes</th>
                <th style={{ textAlign: "right" }}>Hardware Audit</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="empty">Loading inspections…</td>
                </tr>
              ) : inspections.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">No inspections completed yet. Click "New Phone Inspection" to begin.</td>
                </tr>
              ) : (
                inspections.map((i) => {
                  const dev = allDevices.find((d) => d.id === i.device_id);
                  return (
                    <tr key={i.id}>
                      <td>{new Date(i.created_at).toLocaleString("en-IN")}</td>
                      <td>
                        {dev ? (
                          <>
                            <b>{dev.brand} {dev.model}</b>
                            {dev.imei1 && <div style={{ fontSize: "10px", color: "#8291a5" }}>IMEI: {dev.imei1}</div>}
                          </>
                        ) : (
                          <code>{i.device_id.slice(0, 10)}...</code>
                        )}
                      </td>
                      <td>
                        <span className="tag" style={{ fontWeight: 700 }}>
                          {i.grade || "Good"}
                        </span>
                      </td>
                      <td>
                        {i.defects && i.defects.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {i.defects.map((d) => (
                              <span key={d} className="tag" style={{ background: "#fff0ef", color: "#b42318" }}>
                                {d}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="tag" style={{ background: "#e8f8f0", color: "#15945b" }}>
                            Passed All (No Defects)
                          </span>
                        )}
                      </td>
                      <td style={{ maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {i.notes || "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="secondary-btn"
                          style={{ padding: "4px 8px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          onClick={() => setSelectedInspectionForView(i)}
                          title="View 8-point hardware checklist"
                        >
                          <Eye size={12} /> View Checklist
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: RUN INSPECTION */}
      {showModal && (
        <div className="modal-backdrop">
          <form className="modal" style={{ maxWidth: "680px", width: "100%" }} onSubmit={handleSubmit}>
            <div className="modal-head">
              <div>
                <h2>Intake Hardware Inspection</h2>
                <p>Run standard 8-point checklist to audit components and log repair defects.</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowModal(false)}>×</button>
            </div>

            <div className="form-grid">
              <label style={{ gridColumn: "1 / -1" }}>
                Target Handset to Inspect *
                <select
                  required
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                >
                  <option value="">-- Choose Handset --</option>
                  {eligibleDevices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.brand} {d.model} (IMEI: {d.imei1 || "N/A"}) — Status: {formatDeviceStatus(d.status)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Overall Cosmetic / Grade
                <select value={grade} onChange={(e) => setGrade(e.target.value)}>
                  <option>Grade A (Excellent)</option>
                  <option>Grade B (Good)</option>
                  <option>Grade C (Fair / Scratched)</option>
                  <option>Damaged / Broken Screen</option>
                  <option>Scrap / Non-Functional</option>
                </select>
              </label>
            </div>

            <div style={{ marginTop: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span className="checklist-section-title">
                  <ShieldCheck size={14} /> 8-Point Systematic Hardware Checklist
                </span>
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  Tap card to toggle Pass / Defect
                </span>
              </div>

              {/* CHECKLIST QUICK ACTIONS TOOLBAR */}
              <ChecklistToolbar
                totalCount={totalChecklistItems}
                passedCount={passedChecklistCount}
                defectCount={defectChecklistCount}
                onPassAll={handlePassAllChecks}
                onClearAll={handleClearAllChecks}
                passAllText="Pass All"
                clearAllText="Flag All Defective"
              />

              {/* RESPONSIVE CHECKLIST CARDS GRID */}
              <div
                className="checklist-grid grid-2-col"
                style={{
                  marginTop: "10px",
                  maxHeight: "360px",
                  overflowY: "auto",
                  paddingRight: "4px",
                }}
              >
                {checkItems.map(({ key, label, desc, category }) => {
                  const passed = checklist[key] !== false;
                  return (
                    <ChecklistCard
                      key={key}
                      id={key}
                      label={label}
                      desc={desc}
                      category={category}
                      passed={passed}
                      onToggle={() => toggleCheck(key)}
                      passLabel="PASS"
                      defectLabel="DEFECT"
                    />
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: "14px" }}>
              <label style={{ fontSize: "11px", color: "#687b92", display: "grid", gap: "4px" }}>
                Inspection Notes & Diagnostic Observations
                <textarea
                  rows={2}
                  placeholder="e.g. Screen glass cracked on top right corner; FaceID sensors intact; needs display replacement."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ border: "1px solid #e0e7ef", borderRadius: "6px", padding: "8px", font: "inherit", fontSize: "11px" }}
                />
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="primary-btn" disabled={submitting || !selectedDeviceId}>
                {submitting ? "Saving..." : "Record Inspection"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: VIEW INSPECTION AUDIT DETAILS & CHECKLIST */}
      {selectedInspectionForView && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: "720px", width: "95%" }}>
            <div className="modal-head">
              <div>
                <span className="tag" style={{ background: "#edf5fc", color: "#0176d3", fontWeight: 700 }}>
                  Intake Diagnostic Inspection
                </span>
                {(() => {
                  const dev = allDevices.find((d) => d.id === selectedInspectionForView.device_id);
                  return (
                    <>
                      <h2 style={{ marginTop: "6px" }}>
                        {dev ? `${dev.brand} ${dev.model}` : "Inspected Handset"}
                      </h2>
                      <p>
                        Date: {new Date(selectedInspectionForView.created_at).toLocaleString("en-IN")} | Grade: <b>{selectedInspectionForView.grade || "Good"}</b> {dev?.imei1 ? `| IMEI: ${dev.imei1}` : ""}
                      </p>
                    </>
                  );
                })()}
              </div>
              <button type="button" className="icon-btn" onClick={() => setSelectedInspectionForView(null)}>×</button>
            </div>

            {/* DEFECT HIGHLIGHTS */}
            <div style={{ marginBottom: "14px" }}>
              {selectedInspectionForView.defects && selectedInspectionForView.defects.length > 0 ? (
                <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px" }}>
                  <b style={{ color: "#991b1b", fontSize: "12px", display: "block", marginBottom: "6px" }}>
                    Detected Defects ({selectedInspectionForView.defects.length}) Routed to Repair:
                  </b>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {selectedInspectionForView.defects.map((def) => (
                      <span key={def} className="tag" style={{ background: "#fff", color: "#b91c1c", border: "1px solid #fca5a5", fontWeight: 700 }}>
                        ✗ {def}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ padding: "10px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <CheckCircle2 size={16} style={{ color: "#16a34a" }} />
                  <span style={{ fontSize: "12px", color: "#15803d", fontWeight: 600 }}>
                    Flawless Hardware Audit — All 8 intake inspection components passed inspection.
                  </span>
                </div>
              )}
            </div>

            {/* CHECKLIST CARDS AUDIT */}
            <div>
              <div className="checklist-section-title" style={{ marginBottom: "8px" }}>
                <ShieldCheck size={14} /> 8-Point Hardware Audit Breakdown:
              </div>
              <div className="checklist-grid grid-2-col" style={{ maxHeight: "360px", overflowY: "auto", paddingRight: "4px" }}>
                {checkItems.map(({ key, label, desc, category }) => {
                  const passed = selectedInspectionForView.checklist
                    ? (selectedInspectionForView.checklist as Record<string, boolean>)[key] !== false
                    : true;
                  return (
                    <ChecklistCard
                      key={key}
                      id={key}
                      label={label}
                      desc={desc}
                      category={category}
                      passed={passed}
                      readOnly={true}
                      passLabel="PASSED"
                      defectLabel="DEFECT"
                    />
                  );
                })}
              </div>
            </div>

            {selectedInspectionForView.notes && (
              <div style={{ marginTop: "14px", padding: "10px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px" }}>
                <b style={{ fontSize: "11px", color: "#475569", display: "block", marginBottom: "4px" }}>
                  Technician Diagnostic Notes:
                </b>
                <p style={{ margin: 0, fontSize: "12px", color: "#1e293b" }}>
                  {selectedInspectionForView.notes}
                </p>
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: "16px" }}>
              <button type="button" className="secondary-btn" onClick={() => setSelectedInspectionForView(null)}>
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
