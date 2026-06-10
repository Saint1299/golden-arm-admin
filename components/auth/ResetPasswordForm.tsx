"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import {
  AuthField,
  AuthHeading,
  AuthNote,
  AuthSubmitButton,
} from "./authUi";

type FieldErrors = {
  next?: string;
  confirm?: string;
};

type Status = "checking" | "ready" | "invalid";

export function ResetPasswordForm() {
  const router = useRouter();
  const { showToast } = useToast();

  const [status, setStatus] = useState<Status>("checking");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  // Supabase's browser client parses the recovery token from the URL hash on
  // load and emits an auth event with a session. We wait for that session; if
  // it never appears the link is expired/invalid and we bounce to /login.
  useEffect(() => {
    const supabase = createClient();
    let settled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !settled) {
        settled = true;
        setStatus("ready");
      }
    });

    const timer = window.setTimeout(async () => {
      if (settled) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        settled = true;
        setStatus("ready");
      } else {
        settled = true;
        setStatus("invalid");
        showToast("Link expired or invalid. Please request a new one.", "error");
        window.setTimeout(() => router.push("/login"), 1400);
      }
    }, 1500);

    return () => {
      window.clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, [router, showToast]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const nextErrors: FieldErrors = {};
    if (next.length < 8) {
      nextErrors.next = "Must be at least 8 characters.";
    }
    if (confirm !== next) {
      nextErrors.confirm = "Passwords do not match.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) {
      showToast(error.message || "Could not update password.", "error");
      setLoading(false);
      return;
    }

    showToast("Password updated. Please sign in.", "success");
    await supabase.auth.signOut();
    setTimeout(() => router.push("/login"), 900);
  }

  if (status !== "ready") {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <AuthHeading title="Reset password" />
        <div style={{ height: 20 }} />
        <AuthNote>
          {status === "checking"
            ? "Verifying your reset link…"
            : "Link expired or invalid. Redirecting to sign in…"}
        </AuthNote>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column" }}
    >
      <AuthHeading
        title="Set a new password"
        subtitle="Choose a password to finish resetting your account."
      />

      <div style={{ height: 24 }} />

      <AuthField
        id="reset-new-password"
        label="New password"
        type="password"
        value={next}
        onChange={(v) => {
          setNext(v);
          if (errors.next) setErrors((p) => ({ ...p, next: undefined }));
        }}
        placeholder="At least 8 characters"
        disabled={loading}
        autoComplete="new-password"
        error={errors.next}
      />

      <div style={{ height: 16 }} />

      <AuthField
        id="reset-confirm-password"
        label="Confirm new password"
        type="password"
        value={confirm}
        onChange={(v) => {
          setConfirm(v);
          if (errors.confirm) setErrors((p) => ({ ...p, confirm: undefined }));
        }}
        placeholder="Re-enter new password"
        disabled={loading}
        autoComplete="new-password"
        error={errors.confirm}
      />

      <div style={{ height: 24 }} />

      <AuthSubmitButton loading={loading} loadingLabel="Updating…">
        Update password
      </AuthSubmitButton>
    </form>
  );
}
