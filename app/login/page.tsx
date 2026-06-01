import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { AmbientOrbs } from "@/components/ui/AmbientOrbs";
import { GlassCard } from "@/components/ui/GlassCard";

export const metadata: Metadata = {
  title: "Sign in · Golden Arm Admin",
};

export default function LoginPage() {
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
          <LoginForm />
        </GlassCard>
      </main>
    </>
  );
}
