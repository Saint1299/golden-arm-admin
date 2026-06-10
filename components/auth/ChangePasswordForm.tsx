"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import {
  AuthField,
  AuthHeading,
  AuthSubmitButton,
} from "./authUi";

type FieldErrors = {
  current?: string;
  next?: string;
  confirm?: string;
};

export function ChangePasswordForm({ email }: { email: string }) {
  const router = useRouter();
  const { showToast } = useToast();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

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

    // Optional safety check: confirm the current password before changing it.
    if (current) {
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (verifyErr) {
        setErrors({ current: "Current password is incorrect." });
        setLoading(false);
        return;
      }
    }

    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) {
      showToast(error.message || "Could not update password.", "error");
      setLoading(false);
      return;
    }

    showToast("Password updated. Please sign in again.", "success");
    await supabase.auth.signOut();
    // Brief delay so the toast is visible before the page tears down.
    setTimeout(() => router.push("/login"), 900);
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column" }}
    >
      <AuthHeading
        title="Change password"
        subtitle="You'll be signed out after updating."
      />

      <div style={{ height: 24 }} />

      <AuthField
        id="current-password"
        label="Current password"
        type="password"
        value={current}
        onChange={(v) => {
          setCurrent(v);
          if (errors.current) setErrors((p) => ({ ...p, current: undefined }));
        }}
        placeholder="••••••••"
        disabled={loading}
        autoComplete="current-password"
        error={errors.current}
      />

      <div style={{ height: 16 }} />

      <AuthField
        id="new-password"
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
        id="confirm-password"
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
