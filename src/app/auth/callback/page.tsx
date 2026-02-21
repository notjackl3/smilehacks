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

      // ✅ Apply role captured during Google login/signup (if present)
      const pendingRole = localStorage.getItem("pending_role") as
        | "dentist"
        | "patient"
        | null

      console.log("Pending role from localStorage:", pendingRole)

      if (pendingRole) {
        localStorage.removeItem("pending_role")

        const user = session.user

        // Check if profile exists
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id, role")
          .eq("id", user.id)
          .single()

        if (existingProfile) {
          // Update existing profile
          const { error: updateErr } = await supabase
            .from("profiles")
            .update({ role: pendingRole })
            .eq("id", user.id)

          if (updateErr) {
            console.error("Role update error:", updateErr.message)
          }
        } else {
          // Create new profile
          const { error: insertErr } = await supabase
            .from("profiles")
            .insert({
              id: user.id,
              role: pendingRole,
            })

          if (insertErr) {
            console.error("Profile creation error:", insertErr.message)
          }
        }
      }

      router.replace("/") // or "/feed"
    }

    finish()
  }, [router])

  return (
    <div className="min-h-svh flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100">
      <div className="text-gray-700 text-lg font-medium">Signing you in…</div>
    </div>
  )
}