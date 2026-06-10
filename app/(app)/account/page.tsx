import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { BackButton } from "@/components/ui/BackButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Account · Golden Arm Admin",
};

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <BackButton href="/hierarchy" />
      <h1
        style={{
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: "#f5f5f7",
          margin: 0,
        }}
      >
        Account
      </h1>
      <p
        style={{
          color: "rgba(245, 245, 247, 0.5)",
          fontSize: 13,
          marginTop: 6,
          marginBottom: 0,
        }}
        title={user.email ?? ""}
      >
        {user.email}
      </p>

      <div style={{ height: 24 }} />

      <GlassCard>
        <ChangePasswordForm email={user.email ?? ""} />
      </GlassCard>
    </div>
  );
}
