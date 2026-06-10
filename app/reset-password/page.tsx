import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { AmbientOrbs } from "@/components/ui/AmbientOrbs";
import { GlassCard } from "@/components/ui/GlassCard";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "Set new password · Golden Arm Admin",
};

export default function ResetPasswordPage() {
  return (
    <>
      <AmbientOrbs />
      <main
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        <GlassCard style={{ maxWidth: 420, width: "100%", margin: "0 auto" }}>
          {/* This route sits outside the (app) layout, so it brings its own
              ToastProvider for the form's success/error toasts. */}
          <ToastProvider>
            <ResetPasswordForm />
          </ToastProvider>
        </GlassCard>
      </main>
    </>
  );
}
