import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  LogIn,
  CheckCircle2,
  Wrench,
  Smartphone,
  Layers,
  ArrowRight,
  Sparkles,
  Cpu,
  Shield,
  Activity,
  UserCheck,
} from "lucide-react";
import { useAuth } from "../lib/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, profile, role, signIn, signOut } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quick Demo Account Auto-Fill
  function fillDemoAccount(demoEmail: string, demoPass: string) {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMsg(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      await signIn(email.trim(), password);
      navigate("/");
    } catch (err: any) {
      console.error("Login error:", err);
      const msg = err?.message || "";
      if (msg.toLowerCase().includes("invalid login credentials")) {
        setErrorMsg("Invalid email or password. Please verify your credentials.");
      } else if (msg.toLowerCase().includes("email not confirmed")) {
        setErrorMsg("Account email is not verified yet in Supabase Auth.");
      } else {
        setErrorMsg(err?.message || "Sign in failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  }

  // Active Session View (If user is already signed in)
  if (user) {
    const roleLabel = role ? role.replace("_", " ").toUpperCase() : "VERIFIED STAFF";
    const initial = (profile?.full_name || user.email || "U").charAt(0).toUpperCase();

    return (
      <div className="login-root">
        <div className="login-active-card">
          <div className="active-badge-wrap">
            <div className="active-avatar">{initial}</div>
            <div className="active-status-dot" />
          </div>

          <span className="active-role-tag">{roleLabel}</span>
          <h2 className="active-title">Welcome Back, {profile?.full_name || "Workshop Member"}</h2>
          <p className="active-sub">
            You are securely authenticated as <b>{user.email}</b>.
          </p>

          <div className="active-info-box">
            <div className="active-info-row">
              <span className="info-label">Active Workshop</span>
              <span className="info-val">Phone Hub Mobile Repair & Refurbishment</span>
            </div>
            <div className="active-info-row">
              <span className="info-label">Security Protocol</span>
              <span className="info-val text-green">
                <ShieldCheck size={14} /> Supabase RLS Session Active
              </span>
            </div>
          </div>

          <div className="active-actions">
            <Link to="/" className="active-dash-btn">
              <span>Open Workshop Workbench</span>
              <ArrowRight size={17} />
            </Link>
            <button type="button" className="active-signout-btn" onClick={() => signOut()}>
              Sign Out & Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-root">
      {/* LEFT COLUMN: HERO SHOWCASE (Desktop) */}
      <div className="login-hero-panel">
        <div className="hero-glow-1" />
        <div className="hero-glow-2" />

        <div className="hero-content">
          {/* Brand Header */}
          <div className="hero-brand">
            <div className="hero-logo-icon">PH</div>
            <div>
              <div className="hero-logo-title">Phone Hub</div>
              <div className="hero-logo-sub">Mobile Repair Workshop OS</div>
            </div>
          </div>

          {/* Value Proposition */}
          <div className="hero-headline-wrap">
            <span className="hero-kicker">
              <Sparkles size={13} /> Enterprise Workshop Platform
            </span>
            <h1 className="hero-heading">
              Intelligent Repair Operations & FIFO Inventory Control
            </h1>
            <p className="hero-desc">
              Complete 360° device intake tracking, automated diagnostic checklists,
              technician bench allocation, and strict first-in-first-out parts valuation.
            </p>
          </div>

          {/* Key Feature Highlights */}
          <div className="hero-features-list">
            <div className="hero-feature-item">
              <div className="feature-icon-box">
                <Smartphone size={18} />
              </div>
              <div>
                <div className="feature-item-title">360° Handset Lifecycle Audit</div>
                <div className="feature-item-desc">
                  Track IMEI intake, repair progress, cost roll-ups, and release gating in real-time.
                </div>
              </div>
            </div>

            <div className="hero-feature-item">
              <div className="feature-icon-box">
                <Layers size={18} />
              </div>
              <div>
                <div className="feature-item-title">Strict FIFO Spare Parts Valuation</div>
                <div className="feature-item-desc">
                  Batch tracking, automated depletion layers, margin analytics, and low-stock alerts.
                </div>
              </div>
            </div>

            <div className="hero-feature-item">
              <div className="feature-icon-box">
                <Cpu size={18} />
              </div>
              <div>
                <div className="feature-item-title">Hardware Quality Control Gate</div>
                <div className="feature-item-desc">
                  Standardized 8-point intake diagnostics and pre-handover QC inspections.
                </div>
              </div>
            </div>
          </div>

          {/* Trust Footer */}
          <div className="hero-footer">
            <div className="hero-stat-pill">
              <Activity size={13} className="text-cyan" />
              <span>99.9% Uptime Audit Traceability</span>
            </div>
            <div className="hero-stat-pill">
              <ShieldCheck size={13} className="text-green" />
              <span>Row-Level Security Enabled</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: LOGIN FORM */}
      <div className="login-form-panel">
        <div className="login-form-container">
          {/* Mobile-Only Header */}
          <div className="login-mobile-header">
            <div className="hero-logo-icon small">PH</div>
            <div>
              <div className="mobile-brand-name">Phone Hub Repair Workshop</div>
              <div className="mobile-brand-desc">Staff Authentication Portal</div>
            </div>
          </div>

          {/* Form Header */}
          <div className="login-header-text">
            <h2 className="login-title">Sign in to your account</h2>
            <p className="login-subtitle">
              Enter your registered workshop credentials to unlock workbench operations.
            </p>
          </div>

          {/* Quick Demo Credentials Pill Bar */}
          <div className="quick-demo-box">
            <div className="quick-demo-head">
              <UserCheck size={13} />
              <span>One-Click Role Demo Sign In</span>
            </div>
            <div className="quick-demo-buttons">
              <button
                type="button"
                className="demo-chip owner"
                onClick={() => fillDemoAccount("phone@gmail.com", "123456")}
                title="Auto-fill Workshop Owner credentials"
              >
                <b>Owner:</b> phone@gmail.com
              </button>
            </div>
          </div>

          {/* Error Alert Box */}
          {errorMsg && (
            <div className="login-error-alert" role="alert">
              <AlertCircle size={18} className="alert-icon" />
              <div>
                <div className="alert-title">Authentication Failed</div>
                <div className="alert-body">{errorMsg}</div>
              </div>
            </div>
          )}

          {/* Authentication Form */}
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-field-group">
              <label htmlFor="staff-email" className="field-label">
                Staff Email Address <span className="req">*</span>
              </label>
              <div className="field-input-wrap">
                <Mail size={16} className="field-icon" />
                <input
                  id="staff-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="e.g. phone@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-input"
                />
              </div>
            </div>

            <div className="form-field-group">
              <div className="password-label-row">
                <label htmlFor="staff-password" className="field-label">
                  Account Password <span className="req">*</span>
                </label>
              </div>
              <div className="field-input-wrap">
                <Lock size={16} className="field-icon" />
                <input
                  id="staff-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your account password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle-btn"
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="login-submit-btn"
            >
              {loading ? (
                <>
                  <div className="spinner-sm" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>Sign In to Workbench</span>
                  <ArrowRight size={17} className="btn-arrow" />
                </>
              )}
            </button>
          </form>

          {/* Security Assurance Badge */}
          <div className="login-security-footer">
            <div className="security-badge-item">
              <ShieldCheck size={16} className="text-green" />
              <span>Enterprise 256-Bit SSL Encrypted Session</span>
            </div>
            <div className="security-subtext">
              Direct connection to workshop Supabase cluster. Permissions are verified automatically by your assigned database role.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
