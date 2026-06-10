"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AuthBackLink,
  AuthField,
  AuthHeading,
  AuthNote,
  AuthSubmitButton,
} from "./authUi";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      // Swallow — we deliberately show the same neutral message whether or not
      // the request succeeded, so the page never reveals account existence.
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <AuthHeading title="Check your email" />
        <div style={{ height: 20 }} />
        <AuthNote>
          If an account exists for that address, we&rsquo;ve sent a reset link.
        </AuthNote>
        <div style={{ height: 20 }} />
        <Link href="/login" style={{ textDecoration: "none" }}>
          <AuthBackLink>← Back to sign in</AuthBackLink>
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column" }}
    >
      <AuthHeading
        title="Reset password"
        subtitle="We'll email you a link to set a new one."
      />

      <div style={{ height: 24 }} />

      <AuthField
        id="forgot-email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="you@goldenarm.ph"
        disabled={loading}
        autoComplete="email"
      />

      <div style={{ height: 24 }} />

      <AuthSubmitButton loading={loading} loadingLabel="Sending…">
        Send reset link
      </AuthSubmitButton>

      <div style={{ height: 16 }} />

      <div style={{ display: "flex", justifyContent: "center" }}>
        <Link href="/login" style={{ textDecoration: "none" }}>
          <AuthBackLink>← Back to sign in</AuthBackLink>
        </Link>
      </div>
    </form>
  );
}
