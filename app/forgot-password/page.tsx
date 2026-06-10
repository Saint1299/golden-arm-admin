import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { AmbientOrbs } from "@/components/ui/AmbientOrbs";
import { GlassCard } from "@/components/ui/GlassCard";

export const metadata: Metadata = {
  title: "Reset password · Golden Arm Admin",
};

export default function ForgotPasswordPage() {
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
          <ForgotPasswordForm />
        </GlassCard>
      </main>
    </>
  );
}
