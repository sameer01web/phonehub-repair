import React from "react";
import { Check, X, AlertTriangle, ShieldCheck } from "lucide-react";

export interface ChecklistItemProps {
  id: string;
  label: string;
  desc?: string;
  passed: boolean;
  onToggle?: () => void;
  category?: string;
  passLabel?: string;
  defectLabel?: string;
  readOnly?: boolean;
}

export function ChecklistCard({
  id,
  label,
  desc,
  passed,
  onToggle,
  category,
  passLabel = "PASS",
  defectLabel = "DEFECT",
  readOnly = false,
}: ChecklistItemProps) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (readOnly || !onToggle) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onToggle();
    }
  }

  return (
    <div
      role="checkbox"
      aria-checked={passed}
      tabIndex={readOnly ? -1 : 0}
      onClick={!readOnly && onToggle ? onToggle : undefined}
      onKeyDown={handleKeyDown}
      className={`checklist-card ${passed ? "is-passed" : "is-defect"}`}
      style={{
        cursor: readOnly ? "default" : "pointer",
      }}
    >
      {/* VISUAL CHECKBOX INDICATOR */}
      <div className="checklist-indicator" aria-hidden="true">
        {passed ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
      </div>

      {/* CHECKLIST ITEM DETAILS */}
      <div className="checklist-body">
        <div className="checklist-header-row">
          <div>
            {category && (
              <span
                style={{
                  display: "inline-block",
                  fontSize: "9px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "#0176d3",
                  letterSpacing: "0.5px",
                  marginBottom: "2px",
                }}
              >
                {category}
              </span>
            )}
            <h4 className="checklist-label">{label}</h4>
          </div>

          <span className={`checklist-tag ${passed ? "pass" : "defect"}`}>
            {passed ? passLabel : defectLabel}
          </span>
        </div>

        {desc && <p className="checklist-desc">{desc}</p>}
      </div>
    </div>
  );
}

export interface ChecklistToolbarProps {
  totalCount: number;
  passedCount: number;
  defectCount: number;
  onPassAll?: () => void;
  onClearAll?: () => void;
  passAllText?: string;
  clearAllText?: string;
  label?: string;
}

export function ChecklistToolbar({
  totalCount,
  passedCount,
  defectCount,
  onPassAll,
  onClearAll,
  passAllText = "Pass All Checks",
  clearAllText = "Mark All Defects",
  label = "Checklist Progress",
}: ChecklistToolbarProps) {
  return (
    <div className="checklist-toolbar">
      <div className="checklist-stats-pill">
        <ShieldCheck size={14} style={{ color: defectCount === 0 ? "#16a34a" : "#dc2626" }} />
        <span>
          {passedCount}/{totalCount} Passed
        </span>
        <span style={{ color: "#cbd5e1" }}>•</span>
        <span style={{ color: defectCount === 0 ? "#16a34a" : "#dc2626" }}>
          {defectCount} {defectCount === 1 ? "Defect" : "Defects"}
        </span>
      </div>

      {(onPassAll || onClearAll) && (
        <div className="checklist-actions">
          {onPassAll && (
            <button
              type="button"
              className="checklist-action-btn pass-all"
              onClick={onPassAll}
              title="Quickly set all items to Passed"
            >
              <Check size={13} strokeWidth={2.5} /> {passAllText}
            </button>
          )}

          {onClearAll && (
            <button
              type="button"
              className="checklist-action-btn clear-all"
              onClick={onClearAll}
              title="Mark all items as defective"
            >
              <X size={13} strokeWidth={2.5} /> {clearAllText}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
