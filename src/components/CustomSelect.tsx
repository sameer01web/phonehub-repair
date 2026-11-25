import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface CustomSelectOption {
  value: string;
  label: string;
  badge?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: (CustomSelectOption | string)[];
  label?: string;
  placeholder?: string;
  style?: React.CSSProperties;
  triggerStyle?: React.CSSProperties;
  className?: string;
  minWidth?: string | number;
  height?: string | number;
  disabled?: boolean;
  align?: "left" | "right";
  menuWidth?: string | number;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  label,
  placeholder = "Select...",
  style,
  triggerStyle,
  className = "",
  minWidth = "140px",
  height,
  disabled = false,
  align = "left",
  menuWidth,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize options to { value, label }
  const normalizedOptions: CustomSelectOption[] = options.map((opt) => {
    if (typeof opt === "string") {
      return { value: opt, label: opt };
    }
    return opt;
  });

  const selectedOption = normalizedOptions.find((o) => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={`custom-select-container ${className}`}
      onClick={(e) => {
        // Prevent events from bubbling to any parent <label> element which would re-trigger click on the button
        e.stopPropagation();
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      onTouchStart={(e) => {
        e.stopPropagation();
      }}
      style={{
        position: "relative",
        display: style?.width === "100%" ? "block" : "inline-block",
        minWidth: minWidth,
        boxSizing: "border-box",
        ...style,
      }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          width: "100%",
          height: height || "38px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          padding: "0 10px 0 12px",
          background: disabled ? "#f8fafc" : "#ffffff",
          border: isOpen ? "1.5px solid #0176d3" : "1.5px solid #cbd5e1",
          borderRadius: "8px",
          boxShadow: isOpen
            ? "0 0 0 3px rgba(1, 118, 211, 0.16)"
            : "0 1px 2px rgba(0, 0, 0, 0.04)",
          cursor: disabled ? "not-allowed" : "pointer",
          fontSize: "12.5px",
          fontFamily: "inherit",
          color: disabled ? "#94a3b8" : "#1e293b",
          transition: "all 0.18s ease",
          outline: "none",
          textAlign: "left",
          boxSizing: "border-box",
          ...triggerStyle,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {label && (
            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
              {label}:
            </span>
          )}
          <span style={{ fontWeight: 500, color: selectedOption ? "#0f172a" : "#94a3b8" }}>
            {displayLabel}
          </span>
        </span>
        <ChevronDown
          size={14}
          style={{
            color: isOpen ? "#0176d3" : "#64748b",
            transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            transform: isOpen ? "rotate(180deg)" : "none",
            flexShrink: 0,
          }}
        />
      </button>

      {/* Floating Menu Popover */}
      {isOpen && (
        <div
          role="listbox"
          onClick={(e) => {
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
          }}
          style={{
            position: "absolute",
            top: "calc(100% + 5px)",
            ...(align === "right" ? { right: 0 } : { left: 0 }),
            width: menuWidth || "100%",
            minWidth: menuWidth || "100%",
            boxSizing: "border-box",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            boxShadow:
              "0 10px 25px -5px rgba(16, 36, 61, 0.15), 0 8px 10px -6px rgba(16, 36, 61, 0.08)",
            padding: "5px",
            zIndex: 1000,
            maxHeight: "260px",
            overflowY: "auto",
            animation: "fadeInSelect 0.15s cubic-bezier(0, 0, 0.2, 1)",
          }}
        >
          {normalizedOptions.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "9px 12px",
                  borderRadius: "6px",
                  fontSize: "12.5px",
                  fontWeight: isSelected ? 600 : 500,
                  color: isSelected ? "#0176d3" : "#1e293b",
                  background: isSelected ? "#edf5fc" : "transparent",
                  cursor: "pointer",
                  transition: "background 0.12s ease",
                  userSelect: "none",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = "#f8fafc";
                    e.currentTarget.style.color = "#0176d3";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#1e293b";
                  }
                }}
              >
                <span>{opt.label}</span>
                {isSelected && <Check size={14} style={{ color: "#0176d3", strokeWidth: 2.5 }} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
