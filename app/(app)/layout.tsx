import { redirect } from "next/navigation";
import { MobileNavProvider, MobileOverlay } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { AmbientOrbs } from "@/components/ui/AmbientOrbs";
import { ToastProvider } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const email = user.email ?? "";
  const fullName =
    (user.user_metadata?.full_name as string | null | undefined) ?? null;

  return (
    <>
      <AmbientOrbs />
      <MobileNavProvider>
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            height: "100vh",
          }}
        >
          <TopBar email={email} fullName={fullName} />
          <div
            style={{
              flex: 1,
              display: "flex",
              minHeight: 0,
            }}
          >
            <Sidebar />
            <main
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "32px 32px 48px 32px",
                minWidth: 0,
              }}
            >
              <ToastProvider>{children}</ToastProvider>
            </main>
          </div>
        </div>
        <MobileOverlay />
      </MobileNavProvider>
    </>
  );
}
