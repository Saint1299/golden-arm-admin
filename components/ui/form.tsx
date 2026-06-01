"use client";

import {
  useId,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

const labelStyle: CSSProperties = {
  display: "block",
  color: "rgba(245, 245, 247, 0.6)",
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.02em",
  textTransform: "uppercase",
  marginBottom: 6,
};

const inputBaseStyle: CSSProperties = {
  width: "100%",
  backgroundColor: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: 8,
  padding: "10px 14px",
  color: "#f5f5f7",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  transition: "border-color 200ms ease-out, box-shadow 200ms ease-out",
};

const inputFocusOverrides: CSSProperties = {
  borderColor: "rgba(201, 169, 97, 0.5)",
  boxShadow: "0 0 0 3px rgba(201, 169, 97, 0.12)",
};

const helperStyle: CSSProperties = {
  marginTop: 6,
  fontSize: 11,
  color: "rgba(245, 245, 247, 0.4)",
};

export function Field({
  label,
  htmlFor,
  helper,
  children,
}: {
  label: string;
  htmlFor?: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor={htmlFor} style={labelStyle}>
        {label}
      </label>
      {children}
      {helper ? <p style={helperStyle}>{helper}</p> : null}
    </div>
  );
}

export function TextInput({
  id,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  disabled,
  autoFocus,
  list,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  list?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      id={id}
      type={type}
      value={value}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      autoFocus={autoFocus}
      list={list}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{ ...inputBaseStyle, ...(focused ? inputFocusOverrides : null) }}
    />
  );
}

export function TextArea({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  rows = 3,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      id={id}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...inputBaseStyle,
        resize: "vertical",
        ...(focused ? inputFocusOverrides : null),
      }}
    />
  );
}

export function SelectInput({
  id,
  value,
  onChange,
  options,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        style={{
          ...inputBaseStyle,
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          paddingRight: 40,
          cursor: disabled ? "not-allowed" : "pointer",
          ...(focused ? inputFocusOverrides : null),
        }}
      >
        {options.map((o) => (
          <option
            key={o.value}
            value={o.value}
            style={{ background: "#080b12" }}
          >
            {o.label}
          </option>
        ))}
      </select>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(245, 245, 247, 0.6)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        style={{
          position: "absolute",
          right: 14,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
        }}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      style={{
        marginTop: 16,
        fontSize: 12,
        color: "#ef4444",
        backgroundColor: "rgba(239, 68, 68, 0.08)",
        border: "1px solid rgba(239, 68, 68, 0.2)",
        borderRadius: 8,
        padding: "10px 12px",
      }}
    >
      {message}
    </div>
  );
}

export function GoldButton({
  children,
  type = "submit",
  disabled,
  onClick,
  fullWidth = true,
  form,
}: {
  children: ReactNode;
  type?: "submit" | "button";
  disabled?: boolean;
  onClick?: () => void;
  fullWidth?: boolean;
  // Lets the button live outside its <form> (e.g. pinned in a Modal footer
  // while the form lives in the scrollable body) and still submit it.
  form?: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      form={form}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: fullWidth ? "100%" : undefined,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        background: "linear-gradient(180deg, #D4B670 0%, #C9A961 100%)",
        color: "#080b12",
        border: "1px solid rgba(201, 169, 97, 0.4)",
        borderRadius: 8,
        padding: "12px 16px",
        fontWeight: 600,
        fontSize: 14,
        fontFamily: "inherit",
        letterSpacing: "-0.01em",
        cursor: disabled ? "wait" : "pointer",
        opacity: disabled ? 0.7 : 1,
        filter: !disabled && hover ? "brightness(1.05)" : "none",
        boxShadow:
          !disabled && hover ? "0 4px 12px rgba(201, 169, 97, 0.25)" : "none",
        transition: "all 200ms ease-out",
      }}
    >
      {children}
    </button>
  );
}

export function CancelButton({
  onClick,
  disabled,
  children = "Cancel",
}: {
  onClick: () => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "transparent",
        border: "none",
        color: hover ? "rgba(245, 245, 247, 0.6)" : "rgba(245, 245, 247, 0.4)",
        fontSize: 13,
        fontFamily: "inherit",
        padding: "8px 0",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "color 200ms ease-out",
        alignSelf: "center",
      }}
    >
      {children}
    </button>
  );
}

// Convenience for generating stable input ids when a caller doesn't supply one.
export function useFieldId(prefix: string): string {
  const raw = useId();
  return `${prefix}-${raw.replace(/[:]/g, "")}`;
}
