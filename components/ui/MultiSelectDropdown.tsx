"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type Option = { value: string; label: string };

// A compact multi-select dropdown: the trigger button shows the field's
// label plus a count chip for how many options are selected; the popover
// lists checkboxes plus a Clear button. Outside-click and Esc close it.
// Stays controlled by the parent — the Set of selected values lives there.
export function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  emptyText,
  disabled,
}: {
  label: string;
  options: Option[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  emptyText?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  }

  function clear() {
    onChange(new Set());
  }

  const count = selected.size;
  const triggerStyle: CSSProperties = {
    width: "100%",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    border: `1px solid ${open ? "rgba(201, 169, 97, 0.5)" : "rgba(255, 255, 255, 0.08)"}`,
    borderRadius: 8,
    padding: "10px 14px",
    color: "#f5f5f7",
    fontSize: 14,
    fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    textAlign: "left",
    boxShadow: open ? "0 0 0 3px rgba(201, 169, 97, 0.12)" : "none",
    transition: "border-color 200ms ease-out, box-shadow 200ms ease-out",
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={triggerStyle}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: count > 0 ? "#f5f5f7" : "rgba(245, 245, 247, 0.55)",
          }}
        >
          {count === 0
            ? emptyText ?? `All ${label.toLowerCase()}s`
            : count === 1
              ? optionLabelForSingle(options, selected)
              : `${count} ${label.toLowerCase()}s`}
        </span>
        {count > 0 ? (
          <span
            className="tabular"
            style={{
              fontSize: 11,
              fontWeight: 600,
              backgroundColor: "rgba(201, 169, 97, 0.18)",
              color: "#d4b670",
              padding: "1px 6px",
              borderRadius: 999,
            }}
          >
            {count}
          </span>
        ) : null}
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(245, 245, 247, 0.6)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms ease-out",
            flexShrink: 0,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-multiselectable
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "calc(100% + 6px)",
            zIndex: 50,
            backgroundColor: "rgba(8, 11, 18, 0.97)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 10,
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.5)",
            maxHeight: 280,
            overflowY: "auto",
            padding: 4,
            animation: "modal-card-in 120ms ease-out",
          }}
        >
          {options.length === 0 ? (
            <div
              style={{
                padding: "12px 12px",
                fontSize: 12,
                color: "rgba(245, 245, 247, 0.5)",
                textAlign: "center",
              }}
            >
              No options available.
            </div>
          ) : (
            <>
              {options.map((opt) => (
                <OptionRow
                  key={opt.value}
                  option={opt}
                  checked={selected.has(opt.value)}
                  onToggle={() => toggle(opt.value)}
                />
              ))}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  padding: "6px 8px 4px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                  marginTop: 4,
                }}
              >
                <button
                  type="button"
                  onClick={clear}
                  disabled={count === 0}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: "inherit",
                    color:
                      count === 0
                        ? "rgba(245, 245, 247, 0.3)"
                        : "rgba(245, 245, 247, 0.6)",
                    cursor: count === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  Clear
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function optionLabelForSingle(options: Option[], selected: Set<string>): string {
  const only = Array.from(selected)[0];
  if (!only) return "";
  const o = options.find((x) => x.value === only);
  return o?.label ?? only;
}

function OptionRow({
  option,
  checked,
  onToggle,
}: {
  option: Option;
  checked: boolean;
  onToggle: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      role="option"
      aria-selected={checked}
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "8px 10px",
        background: hover ? "rgba(255, 255, 255, 0.04)" : "transparent",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
        fontSize: 13,
        fontFamily: "inherit",
        color: "#f5f5f7",
        textAlign: "left",
        transition: "background-color 120ms ease-out",
      }}
    >
      <CheckBox checked={checked} />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={option.label}
      >
        {option.label}
      </span>
    </button>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 14,
        height: 14,
        flexShrink: 0,
        borderRadius: 3,
        backgroundColor: checked
          ? "rgba(201, 169, 97, 0.20)"
          : "rgba(255, 255, 255, 0.04)",
        border: `1px solid ${checked ? "rgba(201, 169, 97, 0.6)" : "rgba(255, 255, 255, 0.18)"}`,
        transition: "background-color 120ms ease-out, border-color 120ms ease-out",
      }}
    >
      {checked ? (
        <svg
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#d4b670"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : null}
    </span>
  );
}
