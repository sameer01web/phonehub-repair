import React, { useState, useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Smartphone,
  Package,
  ClipboardList,
  Wrench,
  CheckCircle2,
  CheckSquare,
  Truck,
  BarChart3,
  Menu,
  ChevronRight,
  ChevronLeft,
  X,
  LogOut,
  LogIn,
  ShieldCheck,
  UserCheck,
  ChevronDown,
  Headphones,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import CustomSelect from "./CustomSelect";

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  roles: string[]; // which roles can see this
}

const allNavItems: NavItem[] = [
  {
    label: "Dashboard",
    to: "/",
    icon: LayoutDashboard,
    roles: ["owner", "workshop_manager", "technician", "inventory", "qc_inspector", "procurement"],
  },
  {
    label: "Phone Inventory",
    to: "/devices",
    icon: Smartphone,
    roles: ["owner", "workshop_manager", "technician", "inventory", "procurement", "qc_inspector"],
  },
  {
    label: "Repair Job Cards",
    to: "/jobs",
    icon: ClipboardList,
    roles: ["owner", "workshop_manager", "technician", "qc_inspector"],
  },
  {
    label: "Intake Inspections",
    to: "/inspections",
    icon: CheckSquare,
    roles: ["owner", "workshop_manager", "technician", "qc_inspector"],
  },
  {
    label: "Quality Control",
    to: "/qc",
    icon: CheckCircle2,
    roles: ["owner", "workshop_manager", "qc_inspector"],
  },
  {
    label: "Spare Parts & FIFO",
    to: "/parts",
    icon: Wrench,
    roles: ["owner", "workshop_manager", "technician", "inventory", "procurement"],
  },
  {
    label: "Accessories",
    to: "/accessories",
    icon: Headphones,
    roles: ["owner", "workshop_manager", "inventory", "procurement"],
  },
  {
    label: "Procurement & POs",
    to: "/procurement",
    icon: Truck,
    roles: ["owner", "workshop_manager", "inventory", "procurement"],
  },
  {
    label: "Goods Receipts (FIFO)",
    to: "/goods-receipts",
    icon: Package,
    roles: ["owner", "workshop_manager", "inventory", "procurement"],
  },
  {
    label: "Reports & Analytics",
    to: "/reports",
    icon: BarChart3,
    roles: ["owner", "workshop_manager", "technician", "inventory", "procurement", "qc_inspector"],
  },
  {
    label: "Staff & Technicians",
    to: "/staff",
    icon: Users,
    roles: ["owner", "workshop_manager"],
  },
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
    try {
      return localStorage.getItem("ph_desktop_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  function handleMenuToggle() {
    if (window.innerWidth <= 768) {
      setOpen((prev) => !prev);
    } else {
      setDesktopCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem("ph_desktop_sidebar_collapsed", String(next));
        } catch {}
        return next;
      });
    }
  }

  // Keyboard shortcut Ctrl+B / Cmd+B for instant desktop sidebar collapse
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        handleMenuToggle();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const { user, profile, role, isAuthorizedForFifo, signOut, switchRole, error } = useAuth();

  // Strict Security Rule: Never default a missing or invalid role to 'owner'
  const currentRole = role || null;

  // Filter links by verified current role: if role is missing/unverified, deny protected links
  const filteredLinks = currentRole
    ? allNavItems.filter((item) => {
        if (currentRole === "owner") return true;
        return item.roles.includes(currentRole);
      })
    : [];

  const userInitial = profile?.full_name
    ? profile.full_name[0].toUpperCase()
    : user?.email
    ? user.email[0].toUpperCase()
    : "PH";

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? "open" : ""} ${desktopCollapsed ? "collapsed" : ""}`}>
        <div className="brand" title={desktopCollapsed ? "Phone Hub Mobile Repair Workshop" : undefined}>
          <div className="brand-mark">PH</div>
          <div className="brand-text">
            <b>PHONE HUB</b>
            <small>MOBILE REPAIR WORKSHOP</small>
          </div>
          <button className="close-nav" onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Navigation list */}
        <nav>
          {filteredLinks.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              title={label}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom Profile & Role Card */}
        <div className="sidebar-bottom" title={desktopCollapsed ? profile?.full_name || user?.email || "User Profile" : undefined}>
          <div className="avatar">{userInitial}</div>
          <div className="user-info-text" style={{ overflow: "hidden", flex: 1 }}>
            <b
              style={{
                fontSize: "12px",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                display: "block",
              }}
            >
              {profile?.full_name || (user?.email ? user.email.split("@")[0] : "Admin Staff")}
            </b>
            <small
              style={{
                textTransform: "capitalize",
                color: isAuthorizedForFifo ? "#15945b" : "#8292a8",
                fontWeight: 600,
              }}
            >
              {currentRole ? `${currentRole.replace("_", " ")} access` : "Unverified / No Access"}
            </small>
          </div>

          {user && (
            <button
              onClick={() => signOut()}
              title="Sign out of Supabase"
              style={{
                background: "transparent",
                border: 0,
                cursor: "pointer",
                padding: 4,
                display: "grid",
                placeItems: "center",
              }}
            >
              <LogOut size={16} className="muted" />
            </button>
          )}
        </div>
      </aside>

      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <main className={`main ${desktopCollapsed ? "collapsed" : ""}`}>
        <header className="topbar">
          <button
            type="button"
            className="menu-btn desktop-collapse-btn"
            onClick={handleMenuToggle}
            title={desktopCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
            aria-label="Toggle navigation sidebar"
          >
            {desktopCollapsed ? (
              <ChevronRight size={19} strokeWidth={2.5} />
            ) : (
              <ChevronLeft size={19} strokeWidth={2.5} />
            )}
          </button>

          <div className="topbar-brand">
            <span className="mobile-brand-mark">PH</span>
            <b className="mobile-title">Phone Hub</b>
            <b className="desktop-title">Phone Hub Mobile Repair Workshop</b>
            <small className="desktop-subtitle"> / Workshop Operations</small>
          </div>

          <div className="top-right">
            {/* Interactive Role Switcher (Preview Only) */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="role-preview-label" style={{ fontSize: "11px", color: "#64748b" }} title="Preview UI permissions in browser (cannot grant backend DB rights)">
                Role Preview:
              </span>
              <CustomSelect
                value={currentRole || ""}
                onChange={(val) => switchRole(val)}
                disabled={!user || !role}
                align="right"
                minWidth="95px"
                height="32px"
                menuWidth="195px"
                triggerStyle={{
                  height: "32px",
                  padding: "0 8px 0 10px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  borderRadius: "7px",
                  background: currentRole ? "#ffffff" : "#fee2e2",
                  color: currentRole ? "#0f172a" : "#991b1b",
                  border: "1.5px solid #cbd5e1",
                }}
                options={[
                  ...(!currentRole ? [{ value: "", label: "No Verified Role" }] : []),
                  { value: "owner", label: "Owner" },
                  { value: "workshop_manager", label: "Workshop Manager" },
                  { value: "technician", label: "Technician" },
                  { value: "inventory", label: "Inventory / Warehouse" },
                  { value: "qc_inspector", label: "QC Inspector" },
                  { value: "procurement", label: "Procurement" },
                ]}
              />
            </div>

            {user ? (
              <span
                className="status-pill"
                style={{
                  background: isAuthorizedForFifo ? "#e8f8f0" : "#f1f7fd",
                  color: isAuthorizedForFifo ? "#15945b" : "#0176d3",
                  fontWeight: 600,
                }}
              >
                <i style={{ background: isAuthorizedForFifo ? "#16a36a" : "#0176d3" }} />
                {user.email}
              </span>
            ) : (
              <NavLink
                to="/login"
                style={{
                  background: "transparent",
                  border: 0,
                  fontSize: "12px",
                  color: "#0176d3",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "5px 10px",
                  borderRadius: "6px",
                  textDecoration: "none",
                }}
              >
                <LogIn size={14} />
                Sign In
              </NavLink>
            )}

            <div className="avatar small">{userInitial}</div>
          </div>
        </header>

        <div className="content">
          {user && !currentRole && (
            <div
              style={{
                padding: "14px 18px",
                marginBottom: "16px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                color: "#991b1b",
                fontSize: "13px",
              }}
            >
              <b>Protected Access Denied:</b> {error || "Your user profile is missing, inactive, or cannot be verified in the database. Protected workshop access is restricted."}
            </div>
          )}

          <Outlet />
        </div>

        {/* Mobile Fixed Bottom Navigation Bar */}
        <nav className="mobile-bottom-bar" aria-label="Mobile Navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) => (isActive ? "mobile-nav-item active" : "mobile-nav-item")}
            onClick={() => setOpen(false)}
          >
            <LayoutDashboard size={19} />
            <span>Home</span>
          </NavLink>

          <NavLink
            to="/jobs"
            className={({ isActive }) => (isActive ? "mobile-nav-item active" : "mobile-nav-item")}
            onClick={() => setOpen(false)}
          >
            <ClipboardList size={19} />
            <span>Jobs</span>
          </NavLink>

          <NavLink
            to="/devices"
            className={({ isActive }) => (isActive ? "mobile-nav-item active" : "mobile-nav-item")}
            onClick={() => setOpen(false)}
          >
            <Smartphone size={19} />
            <span>Phones</span>
          </NavLink>

          <NavLink
            to="/parts"
            className={({ isActive }) => (isActive ? "mobile-nav-item active" : "mobile-nav-item")}
            onClick={() => setOpen(false)}
          >
            <Wrench size={19} />
            <span>Parts</span>
          </NavLink>

          {/* Hamburger Menu Button - Placed at bottom for easy thumb access */}
          <button
            type="button"
            className="mobile-nav-item mobile-hamburger-btn"
            onClick={() => setOpen(true)}
            aria-label="Open Full Navigation Menu"
          >
            <Menu size={20} />
            <span>Menu</span>
          </button>
        </nav>
      </main>
    </div>
  );
}
