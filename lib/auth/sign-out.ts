"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Single source of truth for the logout flow. Returns a stable async handler
// plus a loading flag.
//
//   const { signOut, loading } = useSignOut();
//   <button onClick={signOut} disabled={loading}>Sign out</button>
export function useSignOut() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  }

  return { signOut, loading };
}
