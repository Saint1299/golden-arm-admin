"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

// Shared form primitives for the auth surfaces (sign in, change password,
// forgot/reset password). These mirror the inline styles originally defined in
// LoginForm so every auth field shares the same dark input + gold focus ring.

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

const inputErrorOverrides: CSSProperties = {
  borderColor: "rgba(239, 68, 68, 0.5)",
};

export function AuthField({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  disabled,
  autoComplete,
  error,
}: {
  id: string;
  label: string;
  type: "email" | "password" | "text";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  error?: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...inputBaseStyle,
          ...(focused ? inputFocusOverrides : null),
          ...(error ? inputErrorOverrides : null),
        }}
      />
      {error ? (
        <div style={{ marginTop: 6, fontSize: 12, color: "#ef4444" }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}

export function AuthSubmitButton({
  loading,
  loadingLabel,
  children,
}: {
  loading: boolean;
  loadingLabel: string;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);

  return (
    <button
      type="submit"
      disabled={loading}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setActive(false);
      }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        width: "100%",
        background: "linear-gradient(180deg, #D4B670 0%, #C9A961 100%)",
        color: "#080b12",
        border: "1px solid rgba(201, 169, 97, 0.4)",
        borderRadius: 8,
        padding: "12px 16px",
        fontWeight: 600,
        fontSize: 14,
        fontFamily: "inherit",
        letterSpacing: "-0.01em",
        cursor: loading ? "wait" : "pointer",
        opacity: loading ? 0.7 : 1,
        filter: !loading && hover ? "brightness(1.05)" : "none",
        boxShadow:
          !loading && hover ? "0 4px 12px rgba(201, 169, 97, 0.25)" : "none",
        transform: !loading && active ? "scale(0.98)" : "scale(1)",
        transition: "all 200ms ease-out",
      }}
    >
      {loading ? loadingLabel : children}
    </button>
  );
}

export function AuthError({ children }: { children: ReactNode }) {
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
      {children}
    </div>
  );
}

export function AuthNote({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 13,
        lineHeight: 1.5,
        color: "rgba(245, 245, 247, 0.7)",
        backgroundColor: "rgba(255, 255, 255, 0.04)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 8,
        padding: "12px 14px",
      }}
    >
      {children}
    </div>
  );
}

const titleStyle: CSSProperties = {
  fontSize: 24,
  fontWeight: 600,
  letterSpacing: "-0.02em",
  color: "#f5f5f7",
  margin: 0,
};

const subtitleStyle: CSSProperties = {
  color: "rgba(245, 245, 247, 0.6)",
  fontSize: 13,
  marginTop: 4,
  marginBottom: 0,
};

export function AuthHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <h1 style={titleStyle}>{title}</h1>
      {subtitle ? <p style={subtitleStyle}>{subtitle}</p> : null}
    </div>
  );
}

const backLinkStyle: CSSProperties = {
  display: "inline-block",
  color: "rgba(245, 245, 247, 0.5)",
  fontSize: 12,
  textDecoration: "none",
  transition: "color 200ms ease-out",
};

export function AuthBackLink({ children }: { children: ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...backLinkStyle,
        color: hover ? "rgba(245, 245, 247, 0.8)" : backLinkStyle.color,
      }}
    >
      {children}
    </span>
  );
}
