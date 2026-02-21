"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

export default function AuthCallbackPage() {
  const router = useRouter()

  React.useEffect(() => {
    async function finish() {
      // With implicit flow, tokens arrive in the URL hash (#...).
      // supabase-js usually stores the session automatically; we "touch" it to be safe.
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        console.error("Callback getSession error:", error.message)
        router.replace("/login")
        return
      }

      let session = data.session

      if (!session) {
        await new Promise((r) => setTimeout(r, 50))
        const retry = await supabase.auth.getSession()
        session = retry.data.session ?? null

        if (!session) {
          console.error("No session after OAuth callback.")
          router.replace("/login")
          return
        }
      }

      // ✅ Apply role captured during Google signup (if present)
      const pendingRole = localStorage.getItem("pending_role") as
        | "dentist"
        | "patient"
        | null

      if (pendingRole) {
        localStorage.removeItem("pending_role")

        const user = session.user

        const { error: roleErr } = await supabase
          .from("profiles")
          .update({ role: pendingRole })
          .eq("id", user.id)

        if (roleErr) {
          console.error("Role update error:", roleErr.message)
          // Don't block navigation; user is still signed in.
        }
      }

      router.replace("/") // or "/feed"
    }

    finish()
  }, [router])

  return (
    <div className="min-h-svh flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white">
      <div className="text-blue-100/80">Signing you in…</div>
    </div>
  )
}