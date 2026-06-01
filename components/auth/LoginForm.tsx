"use client";

import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { createClient } from "@/lib/supabase/client";

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

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [forgotHover, setForgotHover] = useState(false);
  const [buttonHover, setButtonHover] = useState(false);
  const [buttonActive, setButtonActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message || "Sign in failed");
        setLoading(false);
        return;
      }

      router.refresh();
      router.push("/dashboard");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Sign in failed");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column" }}
    >
      <h1
        style={{
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: "#f5f5f7",
        }}
      >
        Sign in
      </h1>
      <p
        style={{
          color: "rgba(245, 245, 247, 0.6)",
          fontSize: 13,
          marginTop: 4,
          marginBottom: 0,
        }}
      >
        Golden Arm Admin
      </p>

      <div style={{ height: 24 }} />

      <div>
        <label htmlFor="login-email" style={labelStyle}>
          Email
        </label>
        <input
          id="login-email"
          type="email"
          placeholder="you@goldenarm.ph"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={() => setEmailFocused(true)}
          onBlur={() => setEmailFocused(false)}
          disabled={loading}
          style={{
            ...inputBaseStyle,
            ...(emailFocused ? inputFocusOverrides : null),
          }}
        />
      </div>

      <div style={{ height: 16 }} />

      <div>
        <label htmlFor="login-password" style={labelStyle}>
          Password
        </label>
        <input
          id="login-password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onFocus={() => setPasswordFocused(true)}
          onBlur={() => setPasswordFocused(false)}
          disabled={loading}
          style={{
            ...inputBaseStyle,
            ...(passwordFocused ? inputFocusOverrides : null),
          }}
        />
      </div>

      <div style={{ height: 8 }} />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <a
          href="#"
          onMouseEnter={() => setForgotHover(true)}
          onMouseLeave={() => setForgotHover(false)}
          style={{
            color: forgotHover
              ? "rgba(245, 245, 247, 0.6)"
              : "rgba(245, 245, 247, 0.4)",
            fontSize: 12,
            textDecoration: "none",
            transition: "color 200ms ease-out",
          }}
        >
          Forgot password?
        </a>
      </div>

      <div style={{ height: 24 }} />

      <button
        type="submit"
        disabled={loading}
        onMouseEnter={() => setButtonHover(true)}
        onMouseLeave={() => {
          setButtonHover(false);
          setButtonActive(false);
        }}
        onMouseDown={() => setButtonActive(true)}
        onMouseUp={() => setButtonActive(false)}
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
          filter: !loading && buttonHover ? "brightness(1.05)" : "none",
          boxShadow:
            !loading && buttonHover
              ? "0 4px 12px rgba(201, 169, 97, 0.25)"
              : "none",
          transform: !loading && buttonActive ? "scale(0.98)" : "scale(1)",
          transition: "all 200ms ease-out",
        }}
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>

      {errorMessage ? (
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
          {errorMessage}
        </div>
      ) : null}
    </form>
  );
}
