"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export function LoginForm(props: React.ComponentProps<typeof Card>) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [role, setRole] = React.useState<"dentist" | "patient">("patient")

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    if (data.session) {
      // Check if profile exists and update/create with role
      const user = data.user
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .single()

      if (existingProfile) {
        // Update existing profile with selected role if needed
        if (!existingProfile.role || existingProfile.role !== role) {
          await supabase
            .from("profiles")
            .update({ role: role })
            .eq("id", user.id)
        }
      } else {
        // Create new profile
        await supabase
          .from("profiles")
          .insert({
            id: user.id,
            role: role,
          })
      }

      router.push("/")
    } else {
      setError("Login failed. Please try again.")
      setLoading(false)
    }
  }

  async function onGoogleLogin() {
    // Store selected role before OAuth redirect
    console.log("Storing role in localStorage:", role)
    localStorage.setItem("pending_role", role)

    const redirectTo = `${window.location.origin}/auth/callback`

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    })

    if (error) console.error("Google sign-in error:", error.message)
  }

  return (
    <Card
      {...props}
      className={[
        "overflow-hidden rounded-2xl shadow-xl",
        "border border-gray-200 bg-white",
        "border-t-4 border-t-blue-500",
        props.className ?? "",
      ].join(" ")}
    >
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl text-gray-900">Welcome back</CardTitle>
        <CardDescription className="text-gray-600">
          Sign in to continue.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-4">
            {/* Role Selection */}
            <div className="grid gap-2">
              <Label className="text-gray-700 font-semibold">
                I am a <span className="text-blue-600">{role}</span>
              </Label>
              <RadioGroup
                value={role}
                onValueChange={(v) => {
                  console.log("Role changed to:", v)
                  setRole(v as "dentist" | "patient")
                }}
                className="grid grid-cols-2 gap-3"
              >
                <label className={`flex items-center gap-2 rounded-lg border-2 p-3 cursor-pointer transition ${
                  role === "patient"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                }`}>
                  <RadioGroupItem value="patient" />
                  <div className="text-sm font-medium text-gray-900">Patient</div>
                </label>

                <label className={`flex items-center gap-2 rounded-lg border-2 p-3 cursor-pointer transition ${
                  role === "dentist"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                }`}>
                  <RadioGroupItem value="dentist" />
                  <div className="text-sm font-medium text-gray-900">Dentist</div>
                </label>
              </RadioGroup>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email" className="text-gray-700">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="m@example.com"
                required
                className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password" className="text-gray-700">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white"
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              onClick={onGoogleLogin}
            >
              Continue with Google
            </Button>

            <p className="text-sm text-gray-600 text-center">
              Don&apos;t have an account?{" "}
              <a
                href="/signup"
                className="text-blue-600 underline underline-offset-4 hover:text-blue-500"
              >
                Create one
              </a>
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}