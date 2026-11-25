import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, X, AlertCircle, CheckCircle2, SwitchCamera, Sparkles } from "lucide-react";

interface CameraImeiScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (scannedImei: string) => void;
  title?: string;
  subtitle?: string;
}

export function extractImeiFromText(raw: string): string {
  if (!raw) return "";
  const cleaned = raw.trim();
  // Look for 14-16 digit sequence typical of IMEI numbers
  const match = cleaned.match(/\b\d{14,16}\b/);
  if (match) return match[0];

  // If no word boundary match, check extracted digits
  const digitsOnly = cleaned.replace(/\D/g, "");
  if (digitsOnly.length >= 14 && digitsOnly.length <= 16) {
    return digitsOnly;
  }

  // Fallback: strip "IMEI:" or "IMEI1:" prefixes
  return cleaned.replace(/^(IMEI|IMEI1|IMEI2|S\/N|SN)[:\s-]*/i, "").trim();
}

export default function CameraImeiScanner({
  isOpen,
  onClose,
  onScan,
  title = "Scan IMEI Barcode with Camera",
  subtitle = "Point camera at the IMEI barcode on the phone back sticker or box",
}: CameraImeiScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const containerId = "imei-camera-reader-viewport";

  useEffect(() => {
    if (!isOpen) {
      cleanupScanner();
      return;
    }

    let isMounted = true;
    setErrorMsg(null);
    setScannedResult(null);
    setIsStarting(true);

    const timer = setTimeout(() => {
      startScanner(isMounted);
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      cleanupScanner();
    };
  }, [isOpen]);

  async function cleanupScanner() {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        // Ignored during cleanup
      }
      scannerRef.current = null;
    }
  }

  async function startScanner(isMounted: boolean) {
    try {
      const element = document.getElementById(containerId);
      if (!element || !isMounted) return;

      const formatsToSupport = [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.DATA_MATRIX,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.CODABAR,
      ];

      const html5QrCode = new Html5Qrcode(containerId, {
        formatsToSupport,
        verbose: false,
      });

      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 20,
          qrbox: { width: 280, height: 130 },
          aspectRatio: 1.333333,
        },
        (decodedText) => {
          const finalImei = extractImeiFromText(decodedText);
          setScannedResult(finalImei);

          // Give quick visual checkmark feedback then pass to parent and close
          setTimeout(() => {
            onScan(finalImei);
            onClose();
          }, 350);
        },
        () => {
          // Frame scan error - ignore per-frame failures
        }
      );

      if (isMounted) {
        setIsStarting(false);
      }
    } catch (err: any) {
      if (!isMounted) return;
      setIsStarting(false);
      console.warn("Camera start error:", err);
      const msg = err?.message || String(err);
      if (msg.includes("Permission") || msg.includes("denied") || msg.includes("NotAllowedError")) {
        setErrorMsg("Camera permission denied. Please allow camera access in your browser settings to scan barcodes.");
      } else if (msg.includes("NotFoundError") || msg.includes("DevicesNotFoundError")) {
        setErrorMsg("No camera device found on this system. You can type the IMEI manually.");
      } else {
        setErrorMsg("Unable to access camera. Please enter the IMEI manually or use a USB barcode scanner.");
      }
    }
  }

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" style={{ zIndex: 90 }}>
      <div
        className="modal"
        style={{
          maxWidth: "460px",
          width: "95%",
          padding: "20px",
          borderRadius: "14px",
          textAlign: "center",
        }}
      >
        {/* Header */}
        <div className="modal-head" style={{ marginBottom: "14px", textAlign: "left" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="tag" style={{ background: "#e0f2fe", color: "#0284c7", fontWeight: 700 }}>
                <Camera size={12} style={{ display: "inline", marginRight: "4px" }} />
                Camera IMEI Scanner
              </span>
            </div>
            <h3 style={{ fontSize: "16px", color: "#152b49", margin: "6px 0 2px" }}>{title}</h3>
            <p style={{ fontSize: "11px", color: "#64748b", margin: 0 }}>{subtitle}</p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            title="Close camera"
          >
            <X size={18} />
          </button>
        </div>

        {/* Success Feedback Banner */}
        {scannedResult && (
          <div
            style={{
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: "8px",
              padding: "10px 14px",
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              color: "#065f46",
              fontWeight: 700,
              fontSize: "13px",
            }}
          >
            <CheckCircle2 size={18} color="#10b981" />
            <span>Captured IMEI: <code>{scannedResult}</code></span>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              padding: "12px 14px",
              marginBottom: "14px",
              textAlign: "left",
              color: "#991b1b",
              fontSize: "12px",
              lineHeight: 1.5,
              display: "flex",
              gap: "8px",
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
            <div>{errorMsg}</div>
          </div>
        )}

        {/* Viewport Video Box */}
        <div
          style={{
            position: "relative",
            width: "100%",
            borderRadius: "10px",
            overflow: "hidden",
            background: "#0f172a",
            minHeight: "260px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid #e2e8f0",
          }}
        >
          {isStarting && !errorMsg && (
            <div style={{ color: "#94a3b8", fontSize: "12px", padding: "20px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  border: "3px solid #38bdf8",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  margin: "0 auto 10px",
                }}
              />
              Initializing Camera & Scanner...
            </div>
          )}

          <div
            id={containerId}
            style={{
              width: "100%",
              height: "100%",
            }}
          />

          {/* Guide Overlay */}
          {!errorMsg && !isStarting && (
            <div
              style={{
                position: "absolute",
                pointerEvents: "none",
                inset: 0,
                display: "grid",
                placeItems: "center",
              }}
            >
              <div
                style={{
                  width: "280px",
                  height: "110px",
                  border: "2px dashed #38bdf8",
                  borderRadius: "8px",
                  boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.45)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    color: "#fff",
                    background: "rgba(15, 23, 42, 0.75)",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    fontWeight: 600,
                    letterSpacing: "0.5px",
                  }}
                >
                  ALIGN IMEI BARCODE HERE
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer / Instructions */}
        <div
          style={{
            marginTop: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "11px", color: "#64748b", textAlign: "left" }}>
            Supports 1D Barcodes, Box Stickers & QR Codes
          </span>

          <button
            type="button"
            className="secondary-btn"
            onClick={onClose}
            style={{ padding: "8px 16px", fontSize: "12px" }}
          >
            Cancel / Manual Entry
          </button>
        </div>
      </div>
    </div>
  );
}
