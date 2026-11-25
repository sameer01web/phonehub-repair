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
} from "lucide-react";
import { useAuth } from "../lib/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, profile, role, signIn, signOut, isAuthorizedForFifo } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      await signIn(email.trim(), password);
      // Success: navigate to home / dashboard
      navigate("/");
    } catch (err: any) {
      console.error("Login error:", err);
      const msg = err?.message || "";
      if (msg.toLowerCase().includes("invalid login credentials")) {
        setErrorMsg("Invalid email or password. Please verify your credentials and try again.");
      } else if (msg.toLowerCase().includes("email not confirmed")) {
        setErrorMsg("Email is not verified yet in Supabase Auth.");
      } else {
        setErrorMsg(err?.message || "Sign in failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  }

  // If already logged in, show current session status
  if (user) {
    return (
      <div
        style={{
          minHeight: "75vh",
          display: "grid",
          placeItems: "center",
          padding: "20px",
        }}
      >
        <div
          className="panel"
          style={{
            maxWidth: "460px",
            width: "100%",
            textAlign: "center",
            padding: "36px 28px",
            borderRadius: "14px",
            boxShadow: "0 10px 30px rgba(16, 36, 61, 0.08)",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "#e8f8f0",
              color: "#15945b",
              display: "grid",
              placeItems: "center",
              margin: "0 auto 16px",
            }}
          >
            <CheckCircle2 size={30} />
          </div>

          <h2 style={{ fontSize: "20px", color: "#152b49", margin: "0 0 6px" }}>
            Already Signed In
          </h2>
          <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 20px" }}>
            You are currently logged in to Phone Hub Workshop.
          </p>

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "16px",
              textAlign: "left",
              marginBottom: "24px",
            }}
          >
            <div style={{ marginBottom: "10px" }}>
              <small style={{ color: "#8291a5", fontSize: "11px", display: "block" }}>Account Email</small>
              <b style={{ color: "#1e293b", fontSize: "14px" }}>{user.email}</b>
            </div>

            <div>
              <small style={{ color: "#8291a5", fontSize: "11px", display: "block" }}>Staff Name & Role</small>
              <b style={{ color: "#0176d3", fontSize: "14px" }}>
                {profile?.full_name || "Workshop Staff"} — {role ? role.replace("_", " ") : "Verified Staff"}
              </b>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <Link
              to="/"
              className="primary-btn"
              style={{ flex: 1, justifyContent: "center", padding: "12px", textDecoration: "none" }}
            >
              Go to Dashboard
            </Link>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => signOut()}
              style={{ padding: "12px 18px" }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "75vh",
        display: "grid",
        placeItems: "center",
        padding: "20px 14px",
      }}
    >
      <div
        className="panel"
        style={{
          maxWidth: "440px",
          width: "100%",
          padding: "34px 28px",
          borderRadius: "14px",
          boxShadow: "0 10px 30px rgba(16, 36, 61, 0.08)",
        }}
      >
        {/* Header with Brand */}
        <div style={{ textAlign: "center", marginBottom: "26px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              background: "#0176d3",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: "18px",
              fontWeight: 800,
              margin: "0 auto 12px",
              boxShadow: "0 4px 12px rgba(1, 118, 211, 0.28)",
            }}
          >
            PH
          </div>
          <h1 style={{ fontSize: "21px", color: "#152b49", margin: "0 0 4px", fontWeight: 800 }}>
            Phone Hub Sign In
          </h1>
          <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
            Mobile Repair Workshop & Inventory Management
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              padding: "12px 14px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              color: "#991b1b",
              fontSize: "12px",
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "1px" }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
          <div>
            <label
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "#475569",
                display: "block",
                marginBottom: "6px",
              }}
            >
              Staff Email Address *
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                padding: "0 12px",
                height: "42px",
              }}
            >
              <Mail size={16} style={{ color: "#94a3b8", marginRight: "10px", flexShrink: 0 }} />
              <input
                type="email"
                required
                placeholder="e.g. phone@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  border: 0,
                  outline: 0,
                  background: "transparent",
                  width: "100%",
                  font: "inherit",
                  fontSize: "14px",
                  color: "#1e293b",
                }}
              />
            </div>
          </div>

          <div>
            <label
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "#475569",
                display: "block",
                marginBottom: "6px",
              }}
            >
              Account Password *
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                padding: "0 12px",
                height: "42px",
              }}
            >
              <Lock size={16} style={{ color: "#94a3b8", marginRight: "10px", flexShrink: 0 }} />
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  border: 0,
                  outline: 0,
                  background: "transparent",
                  width: "100%",
                  font: "inherit",
                  fontSize: "14px",
                  color: "#1e293b",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  border: 0,
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: 4,
                  display: "grid",
                  placeItems: "center",
                }}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="primary-btn"
            disabled={loading}
            style={{
              height: "44px",
              fontSize: "14px",
              fontWeight: 700,
              justifyContent: "center",
              marginTop: "8px",
              borderRadius: "8px",
            }}
          >
            <LogIn size={17} />
            {loading ? "Verifying Credentials..." : "Sign In to Workshop"}
          </button>
        </form>

        <div
          style={{
            marginTop: "24px",
            paddingTop: "18px",
            borderTop: "1px solid #edf2f7",
            textAlign: "center",
            fontSize: "11px",
            color: "#64748b",
            lineHeight: 1.6,
          }}
        >
          <ShieldCheck size={14} style={{ display: "inline", marginRight: "4px", color: "#16a34a" }} />
          Direct Supabase Authentication. Roles (Owner, Technician, Manager, Inventory) are enforced automatically from your registered profile.
        </div>
      </div>
    </div>
  );
}
