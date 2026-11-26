import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Shield,
  Wrench,
  CheckCircle2,
  RefreshCw,
  Layers,
  CheckSquare,
  Edit2,
  Trash2,
  X,
} from "lucide-react";
import {
  getStaffProfiles,
  getJobCards,
  setStaffStatusOverride,
  clearStaffStatusOverride,
  isStaffMemberActive,
  deleteStaffProfile,
} from "../lib/repairs";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Profile, Job } from "../lib/types";
import { createClient } from "@supabase/supabase-js";
import CustomSelect from "../components/CustomSelect";

const ROLES = [
  { value: "owner", label: "Owner / Workshop Admin", color: "#0176d3", bg: "#e8f3fd", desc: "Full administrative access to workshop, finances & staff" },
  { value: "workshop_manager", label: "Workshop Manager", color: "#7955c7", bg: "#f1edff", desc: "Manages job allocations, workflows and reports" },
  { value: "technician", label: "Technician", color: "#e68a2e", bg: "#fff5eb", desc: "Performs smartphone hardware & chip-level repairs" },
  { value: "inventory", label: "Inventory / Warehouse", color: "#15945b", bg: "#e8f8f0", desc: "Manages spare parts, FIFO batches and goods receipts" },
  { value: "qc_inspector", label: "QC Inspector", color: "#0878d1", bg: "#e8f3fd", desc: "Conducts pre-repair and post-repair quality gate audits" },
  { value: "procurement", label: "Procurement Officer", color: "#b45309", bg: "#fef3c7", desc: "Manages suppliers and purchase orders" },
];

const SPECIALIZATIONS = [
  "General Mobile Technician",
  "Display & Glass Specialist",
  "Motherboard & IC Specialist",
  "Battery & Power Specialist",
  "Charging Port & Jack Specialist",
  "Camera & Optics Specialist",
  "Software & Flashing Specialist",
  "Network & Hardware Specialist",
];

export default function StaffPage() {
  const { user, role: currentRole } = useAuth();
  const [staff, setStaff] = useState<Profile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Staff Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("technician");
  const [selectedSpec, setSelectedSpec] = useState(SPECIALIZATIONS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Edit Staff Modal
  const [editingStaff, setEditingStaff] = useState<Profile | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editRole, setEditRole] = useState("technician");

  function startEditStaff(member: Profile) {
    setEditingStaff(member);
    setEditFullName(member.full_name || "");
    setEditRole(member.role || "technician");
  }

  async function handleUpdateStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!editingStaff) return;
    setSubmitting(true);
    try {
      const updatedName = editFullName.trim();
      if (supabase) {
        // 1. Try secure update_staff_member RPC first
        const { error: rpcErr } = await supabase.rpc("update_staff_member", {
          target_user_id: editingStaff.id,
          new_full_name: updatedName,
          new_role: editRole,
        });

        // 2. If RPC not available, fallback to direct update
        if (rpcErr) {
          const { error: directErr } = await supabase
            .from("profiles")
            .update({
              full_name: updatedName,
              role: editRole,
            })
            .eq("id", editingStaff.id);
          if (directErr) {
            if (directErr.code === "42501" || directErr.message?.includes("permission denied")) {
              throw new Error(
                "Permission Denied: Supabase database me profiles update permission missing hai. Kripya Supabase SQL Editor me 009_fix_profiles_rls_recursion.sql query run karein."
              );
            }
            throw directErr;
          }
        }
      }
      setStaff((prev) =>
        prev.map((s) =>
          s.id === editingStaff.id
            ? { ...s, full_name: updatedName, role: editRole }
            : s
        )
      );
      setEditingStaff(null);
      setStatusMessage({ type: "success", text: `Staff profile "${updatedName}" updated successfully.` });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      alert(err?.message || "Failed to update staff profile");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteStaff(member: Profile) {
    if (member.id === user?.id) {
      setStatusMessage({ type: "error", text: "Aap apne khud ke logged-in account ko delete nahi kar sakte." });
      return;
    }
    const staffName = member.full_name?.trim() || "Staff Member";
    const confirmDelete = window.confirm(
      `Are you sure you want to delete staff account "${staffName}"? This action cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      setSubmitting(true);
      await deleteStaffProfile(member.id);
      setStaff((prev) => prev.filter((s) => s.id !== member.id));
      setStatusMessage({
        type: "success",
        text: `Staff profile "${staffName}" successfully deleted from workshop records.`,
      });
    } catch (err: any) {
      console.error("Staff delete error:", err);
      setStatusMessage({
        type: "error",
        text: err?.message || "Failed to delete staff member.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(member: Profile) {
    if (member.id === user?.id) {
      alert("Aap apne khud ke logged-in account ko deactivate nahi kar sakte.");
      return;
    }

    const currentActive = isStaffMemberActive(member);
    const newStatus = !currentActive;

    // 1. Update local storage override for instant synchronization
    setStaffStatusOverride(member.id, newStatus);

    // 2. Optimistic local state update
    setStaff((prev) =>
      prev.map((s) => (s.id === member.id ? { ...s, is_active: newStatus } : s))
    );

    setTogglingId(member.id);

    try {
      if (supabase) {
        await supabase.from("profiles").update({ is_active: newStatus }).eq("id", member.id);
      }
    } catch (err) {
      console.warn("Database sync notice (saved locally):", err);
    } finally {
      setTogglingId(null);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const [staffList, jobList] = await Promise.all([
        getStaffProfiles(),
        getJobCards().catch(() => []),
      ]);
      setStaff(staffList);
      setJobs(jobList);
    } catch (err) {
      console.warn("Could not load staff data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !fullName.trim()) {
      setStatusMessage({ type: "error", text: "Please fill all required fields (Name, Email, Password)." });
      return;
    }
    if (password.length < 6) {
      setStatusMessage({ type: "error", text: "Password must be at least 6 characters long." });
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!url || !key) {
        throw new Error("Supabase credentials not configured in environment.");
      }

      // Create an unpersisted secondary client so the current admin session is not signed out
      const secondaryClient = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      let techNameWithSpec = fullName.trim();
      if (selectedRole === "technician" && selectedSpec) {
        techNameWithSpec = `${fullName.trim()} (${selectedSpec.replace(" Specialist", "")})`;
      }

      // 1. Sign up user through Auth
      const { data: authData, error: signUpError } = await secondaryClient.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: techNameWithSpec,
          },
        },
      });

      if (signUpError) {
        throw new Error(signUpError.message);
      }

      const newUserId = authData.user?.id;
      if (!newUserId) {
        throw new Error("User creation failed. No user ID returned.");
      }

      // 2. Update role in profiles table using owner's authenticated client
      if (supabase) {
        // Wait 400ms for database trigger to initialize profile
        await new Promise((r) => setTimeout(r, 400));
        try {
          await supabase.from("profiles").upsert({
            id: newUserId,
            full_name: techNameWithSpec,
            role: selectedRole,
            is_active: true,
          });
        } catch (err) {
          console.warn("Direct profile role upsert notice:", err);
        }
      }

      setStatusMessage({
        type: "success",
        text: `Account for ${fullName} (${selectedRole.toUpperCase()}) created successfully! They can now log in using their email and password.`,
      });

      setFullName("");
      setEmail("");
      setPassword("");
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err?.message || "Failed to create user account. Check Supabase Auth configuration.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="page-head">
        <div>
          <div className="eyebrow">WORKSHOP TEAM & ROLE MANAGEMENT</div>
          <h1>Staff & Technician Management</h1>
          <p>Manage workshop staff profiles, assign technicians to repair benches, and configure administrative roles.</p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button className="secondary-btn" onClick={loadData} title="Refresh">
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            Refresh
          </button>
          <button className="primary-btn" onClick={() => setIsModalOpen(true)}>
            <UserPlus size={16} />
            Add Staff / Technician
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            marginBottom: "18px",
            borderRadius: "8px",
            background: statusMessage.type === "success" ? "#e8f8f0" : "#fee2e2",
            color: statusMessage.type === "success" ? "#15803d" : "#991b1b",
            border: `1px solid ${statusMessage.type === "success" ? "#bbf7d0" : "#fecaca"}`,
            fontSize: "12px",
            fontWeight: 500,
          }}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: statusMessage.type === "success" ? "#15803d" : "#991b1b",
              padding: "0 4px",
              fontSize: "16px",
              lineHeight: 1,
            }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Role Counts Summary */}
      <div className="responsive-grid-4" style={{ marginBottom: "22px" }}>
        <div className="stat-card">
          <div className="stat-icon Blue"><Shield size={18} /></div>
          <div className="stat-label">Admins & Owners</div>
          <div className="stat-value">{staff.filter((s) => s.role === "owner" || s.role === "workshop_manager").length}</div>
          <div className="stat-foot">Full administrative controls</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon Orange"><Wrench size={18} /></div>
          <div className="stat-label">Bench Technicians</div>
          <div className="stat-value">{staff.filter((s) => s.role === "technician").length}</div>
          <div className="stat-foot">Available for job card assignment</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon Green"><Layers size={18} /></div>
          <div className="stat-label">Inventory & Procurement</div>
          <div className="stat-value">{staff.filter((s) => s.role === "inventory" || s.role === "procurement").length}</div>
          <div className="stat-foot">FIFO parts & goods receipts</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon Purple"><CheckSquare size={18} /></div>
          <div className="stat-label">QC Inspectors</div>
          <div className="stat-value">{staff.filter((s) => s.role === "qc_inspector").length}</div>
          <div className="stat-foot">Pre & post repair testing</div>
        </div>
      </div>

      {/* Staff Roster Table */}
      <div className="panel" style={{ marginBottom: "22px" }}>
        <div className="section-head">
          <div>
            <h2>Registered Workshop Staff & Technicians</h2>
            <p>Active workshop accounts synchronized with Supabase Profiles</p>
          </div>
          <Users size={18} className="muted" />
        </div>

        {/* Desktop Table */}
        <div className="table-wrap desktop-staff-table" style={{ marginTop: "12px" }}>
          <table>
            <thead>
              <tr>
                <th>Staff Name</th>
                <th>Role & Access Level</th>
                <th>Status</th>
                <th>Phones Repaired</th>
                <th>Active Bench Work</th>
                <th>User ID</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                    Loading workshop staff profiles...
                  </td>
                </tr>
              ) : staff.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "34px", color: "#64748b" }}>
                    No staff profiles registered yet.
                  </td>
                </tr>
              ) : (
                staff.map((member) => {
                  const roleConfig = ROLES.find((r) => r.value === member.role) || {
                    label: member.role,
                    color: "#64748b",
                    bg: "#f1f5f9",
                  };

                  const activeJobCount = jobs.filter(
                    (j) =>
                      j.status !== "completed" &&
                      j.status !== "delivered" &&
                      j.assignments?.some((a) => a.technician_id === member.id)
                  ).length;

                  const repairedCount = jobs.filter(
                    (j) =>
                      (j.status === "completed" || j.status === "delivered") &&
                      j.assignments?.some((a) => a.technician_id === member.id)
                  ).length;

                  const isActive = isStaffMemberActive(member);
                  const isSelf = member.id === user?.id;

                  return (
                    <tr
                      key={member.id}
                      style={{
                        opacity: isActive ? 1 : 0.42,
                        background: isActive ? "transparent" : "rgba(241, 245, 249, 0.45)",
                        filter: isActive ? "none" : "grayscale(25%)",
                        transition: "all 0.25s ease",
                      }}
                    >
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              background: "#e0f2fe",
                              color: "#0369a1",
                              fontWeight: 700,
                              display: "grid",
                              placeItems: "center",
                              fontSize: "12px",
                            }}
                          >
                            {(member.full_name?.trim() || (member.role === "technician" ? "T" : "S"))[0].toUpperCase()}
                          </div>
                          <div>
                            <b style={{ color: "#1e293b", fontSize: "13px" }}>
                              {member.full_name?.trim() || (member.role === "technician" ? "Technician" : "Staff Member")}
                            </b>
                            {member.id === user?.id && (
                              <span
                                style={{
                                  marginLeft: "8px",
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  background: "#dcfce7",
                                  color: "#166534",
                                  padding: "2px 6px",
                                  borderRadius: "10px",
                                }}
                              >
                                Current Login
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            borderRadius: "14px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background: roleConfig.bg,
                            color: roleConfig.color,
                          }}
                        >
                          {roleConfig.label}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          {/* Active / Deactive Slider Switch */}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isActive}
                            disabled={isSelf || togglingId === member.id}
                            onClick={() => handleToggleActive(member)}
                            title={
                              isSelf
                                ? "Aap apne logged-in account ko deactivate nahi kar sakte"
                                : isActive
                                ? "Click karke Deactivate karein"
                                : "Click karke Activate karein"
                            }
                            style={{
                              position: "relative",
                              width: "44px",
                              height: "24px",
                              borderRadius: "12px",
                              background: isActive ? "#16a34a" : "#cbd5e1",
                              border: "none",
                              cursor: isSelf ? "not-allowed" : "pointer",
                              padding: "2px",
                              transition: "background-color 0.25s ease",
                              opacity: isSelf ? 0.6 : 1,
                              display: "inline-flex",
                              alignItems: "center",
                              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.12)",
                              outline: "none",
                            }}
                          >
                            <span
                              style={{
                                display: "block",
                                width: "20px",
                                height: "20px",
                                borderRadius: "50%",
                                background: "#ffffff",
                                boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
                                transform: isActive ? "translateX(20px)" : "translateX(0px)",
                                transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                              }}
                            />
                          </button>

                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: 700,
                              color: isActive ? "#15803d" : "#64748b",
                              minWidth: "60px",
                            }}
                          >
                            {isActive ? "Active" : "Deactive"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className="tag"
                          style={{
                            background: repairedCount > 0 ? "#e8f8f0" : "#f1f5f9",
                            color: repairedCount > 0 ? "#15945b" : "#64748b",
                            fontWeight: 700,
                            fontSize: "11px",
                            padding: "4px 8px",
                            borderRadius: "12px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <CheckCircle2 size={12} />
                          {repairedCount} Phones Repaired
                        </span>
                      </td>

                      <td>
                        <b style={{ color: activeJobCount > 0 ? "#e68a2e" : "#64748b" }}>
                          {activeJobCount} in progress
                        </b>
                      </td>

                      <td>
                        <span style={{ fontFamily: "monospace", fontSize: "10px", color: "#94a3b8" }}>
                          {member.id.slice(0, 8)}…
                        </span>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => startEditStaff(member)}
                            title="Edit Staff Member"
                            style={{ height: "30px", width: "30px", borderRadius: "6px" }}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            disabled={isSelf}
                            onClick={() => handleDeleteStaff(member)}
                            title={isSelf ? "Aap apne logged-in account ko delete nahi kar sakte" : "Delete Staff Profile"}
                            style={{
                              color: isSelf ? "#cbd5e1" : "#b42318",
                              cursor: isSelf ? "not-allowed" : "pointer",
                              height: "30px",
                              width: "30px",
                              borderRadius: "6px",
                            }}
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

        {/* Mobile View: Touch-Friendly Staff Cards */}
        <div className="mobile-staff-cards" style={{ marginTop: "12px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
              Loading workshop staff profiles...
            </div>
          ) : staff.length === 0 ? (
            <div style={{ textAlign: "center", padding: "34px", color: "#64748b", background: "#f8fafc", borderRadius: "8px" }}>
              No staff profiles registered yet.
            </div>
          ) : (
            staff.map((member) => {
              const roleConfig = ROLES.find((r) => r.value === member.role) || {
                label: member.role,
                color: "#64748b",
                bg: "#f1f5f9",
              };

              const activeJobCount = jobs.filter(
                (j) =>
                  j.status !== "completed" &&
                  j.status !== "delivered" &&
                  j.assignments?.some((a) => a.technician_id === member.id)
              ).length;

              const repairedCount = jobs.filter(
                (j) =>
                  (j.status === "completed" || j.status === "delivered") &&
                  j.assignments?.some((a) => a.technician_id === member.id)
              ).length;

              const isActive = isStaffMemberActive(member);
              const isSelf = member.id === user?.id;

              return (
                <div
                  key={member.id}
                  className="mobile-staff-card"
                  style={{
                    opacity: isActive ? 1 : 0.42,
                    background: isActive ? "#ffffff" : "rgba(241, 245, 249, 0.5)",
                    filter: isActive ? "none" : "grayscale(25%)",
                    transition: "all 0.25s ease",
                  }}
                >
                  {/* Header: Avatar, Name, Role & Status Toggle */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          background: "#e0f2fe",
                          color: "#0369a1",
                          fontWeight: 700,
                          display: "grid",
                          placeItems: "center",
                          fontSize: "13px",
                          flexShrink: 0,
                        }}
                      >
                        {(member.full_name?.trim() || (member.role === "technician" ? "T" : "S"))[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <b style={{ color: "#1e293b", fontSize: "14px" }}>
                            {member.full_name?.trim() || (member.role === "technician" ? "Technician" : "Staff Member")}
                          </b>
                          {isSelf && (
                            <span style={{ fontSize: "9px", fontWeight: 700, background: "#dcfce7", color: "#166534", padding: "1px 5px", borderRadius: "8px" }}>
                              You
                            </span>
                          )}
                        </div>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "10px",
                            fontSize: "10px",
                            fontWeight: 700,
                            background: roleConfig.bg,
                            color: roleConfig.color,
                            marginTop: "3px",
                          }}
                        >
                          {roleConfig.label}
                        </span>
                      </div>
                    </div>

                    {/* Active Toggle Switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isActive}
                      disabled={isSelf || togglingId === member.id}
                      onClick={() => handleToggleActive(member)}
                      style={{
                        position: "relative",
                        width: "44px",
                        height: "22px",
                        borderRadius: "11px",
                        background: isSelf ? "#cbd5e1" : isActive ? "#15803d" : "#94a3b8",
                        border: "none",
                        cursor: isSelf ? "not-allowed" : "pointer",
                        padding: 0,
                        flexShrink: 0,
                        transition: "background 0.25s ease",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: "2px",
                          left: isActive ? "24px" : "2px",
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          background: "#ffffff",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                          transition: "left 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                      />
                    </button>
                  </div>

                  {/* Metrics Box */}
                  <div className="mobile-part-metrics" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    <div className="mobile-part-metric-item">
                      <span style={{ fontSize: "10px", color: "#64748b" }}>Repairs Completed</span>
                      <b style={{ fontSize: "13px", color: repairedCount > 0 ? "#15945b" : "#64748b" }}>
                        ✓ {repairedCount} phones
                      </b>
                    </div>
                    <div className="mobile-part-metric-item">
                      <span style={{ fontSize: "10px", color: "#64748b" }}>Active Bench Work</span>
                      <b style={{ fontSize: "13px", color: activeJobCount > 0 ? "#e68a2e" : "#64748b" }}>
                        🔧 {activeJobCount} in progress
                      </b>
                    </div>
                  </div>

                  {/* Footer & Actions */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px dashed #e2e8f0" }}>
                    <span style={{ fontFamily: "monospace", fontSize: "10px", color: "#94a3b8" }}>
                      ID: {member.id.slice(0, 8)}…
                    </span>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        className="secondary-btn"
                        style={{ padding: "4px 10px", fontSize: "11px" }}
                        onClick={() => startEditStaff(member)}
                      >
                        <Edit2 size={12} style={{ marginRight: 3 }} /> Edit
                      </button>
                      <button
                        type="button"
                        className="secondary-btn"
                        disabled={isSelf}
                        onClick={() => handleDeleteStaff(member)}
                        style={{
                          padding: "4px 8px",
                          fontSize: "11px",
                          color: isSelf ? "#cbd5e1" : "#b42318",
                          borderColor: isSelf ? "#e2e8f0" : "#fecaca",
                          cursor: isSelf ? "not-allowed" : "pointer",
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Staff Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ width: "min(520px, 95%)" }}>
            <div className="modal-head">
              <div>
                <h2>Add Staff Member / Technician</h2>
                <p>Register a new user account and assign their workshop role.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: "transparent", border: 0, cursor: "pointer", color: "#64748b", fontSize: "18px" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStaff}>
              <div style={{ display: "grid", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "11px", color: "#475569", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    style={{
                      width: "100%",
                      height: "38px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      padding: "0 10px",
                      fontSize: "13px",
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: "11px", color: "#475569", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. rahul.phonehub@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: "100%",
                      height: "38px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      padding: "0 10px",
                      fontSize: "13px",
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: "11px", color: "#475569", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                    Login Password * (Min 6 characters)
                  </label>
                  <input
                    type="password"
                    placeholder="Set a secure password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: "100%",
                      height: "38px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      padding: "0 10px",
                      fontSize: "13px",
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: "11px", color: "#475569", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                    Select Role *
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    style={{
                      width: "100%",
                      height: "38px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      padding: "0 10px",
                      fontSize: "13px",
                      background: "#fff",
                    }}
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedRole === "technician" && (
                  <div>
                    <label style={{ fontSize: "11px", color: "#475569", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                      Technician Specialization
                    </label>
                    <select
                      value={selectedSpec}
                      onChange={(e) => setSelectedSpec(e.target.value)}
                      style={{
                        width: "100%",
                        height: "38px",
                        border: "1px solid #cbd5e1",
                        borderRadius: "6px",
                        padding: "0 10px",
                        fontSize: "13px",
                        background: "#fff",
                      }}
                    >
                      {SPECIALIZATIONS.map((spec) => (
                        <option key={spec} value={spec}>
                          {spec}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="modal-actions" style={{ marginTop: "22px" }}>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={submitting}>
                  {submitting ? "Creating User..." : "Create Staff Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="modal-backdrop">
          <div className="modal" style={{ width: "min(520px, 95%)" }}>
            <div className="modal-head">
              <div>
                <h2>Edit Staff Member / Technician</h2>
                <p>Modify staff name or assign a different workshop role.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                style={{ background: "transparent", border: 0, cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateStaff}>
              <div style={{ display: "grid", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#334155", display: "block", marginBottom: "6px" }}>
                    Staff Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    style={{
                      width: "100%",
                      height: "38px",
                      border: "1.5px solid #cbd5e1",
                      borderRadius: "8px",
                      padding: "0 12px",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#334155", display: "block", marginBottom: "6px" }}>
                    Role & Access Level *
                  </label>
                  <CustomSelect
                    value={editRole}
                    onChange={(val) => setEditRole(val)}
                    options={ROLES.map((r) => ({ value: r.value, label: r.label }))}
                    style={{ width: "100%" }}
                    minWidth="100%"
                    height="38px"
                  />
                </div>

                <div className="modal-actions" style={{ marginTop: "10px" }}>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => setEditingStaff(null)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={submitting}
                  >
                    {submitting ? "Saving..." : "Update Staff Member"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
