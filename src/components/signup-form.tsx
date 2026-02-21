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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export function SignupForm(props: React.ComponentProps<typeof Card>) {
  const router = useRouter()
  const [role, setRole] = React.useState<"dentist" | "patient">("dentist")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const confirmPassword = formData.get("confirm-password") as string
    const name = formData.get("name") as string

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      setLoading(false)
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role: role,
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Create profile entry (only id and role - email is in auth.users)
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: data.user.id,
          role: role,
        })

      if (profileError) {
        console.error("Profile creation error:", profileError.message)
      }

      // If we have a session, user is logged in
      if (data.session) {
        router.push("/")
        return
      }

      // No session - try to sign in with the password to bypass email verification
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError || !signInData.session) {
        // Email verification is required but emails aren't working
        // Sign in manually with the credentials
        console.log("Account created but requires verification. Attempting auto-login...")

        // Try one more time after a short delay
        await new Promise(resolve => setTimeout(resolve, 1000))
        const { data: retryData } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (retryData?.session) {
          router.push("/")
          return
        }

        // If still no session, the account was created but they can't log in yet
        setError("Account created! You can now log in with your credentials.")
        setLoading(false)

        // Redirect to login page after 2 seconds
        setTimeout(() => {
          router.push("/login")
        }, 2000)
        return
      }

      // Successfully signed in
      router.push("/")
    } else {
      setError("Signup failed. Please try again.")
      setLoading(false)
    }
  }

  async function onGoogleSignup() {
    // ✅ persist selected role across OAuth redirect
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
        <CardTitle className="text-2xl text-gray-900">Create an account</CardTitle>
        <CardDescription className="text-gray-600">
          Enter your information below to create your account.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <FieldGroup>
            {/* Role */}
            <Field>
              <FieldLabel className="text-gray-700 font-semibold">
                I am signing up as a <span className="text-blue-600">{role}</span>
              </FieldLabel>
              <RadioGroup
                value={role}
                onValueChange={(v) => {
                  console.log("Role changed to:", v)
                  setRole(v as "dentist" | "patient")
                }}
                className="grid grid-cols-2 gap-3"
              >
                <label className={`flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition ${
                  role === "patient"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                }`}>
                  <RadioGroupItem value="patient" />
                  <div className="leading-tight">
                    <div className="text-sm font-medium text-gray-900">Patient</div>
                  </div>
                </label>

                <label className={`flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition ${
                  role === "dentist"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                }`}>
                  <RadioGroupItem value="dentist" />
                  <div className="leading-tight">
                    <div className="text-sm font-medium text-gray-900">Dentist</div>
                  </div>
                </label>
              </RadioGroup>
            </Field>

            {/* Name */}
            <Field>
              <FieldLabel htmlFor="name" className="text-gray-700">Full name</FieldLabel>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="John Doe"
                required
                className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
              />
            </Field>

            {/* Email */}
            <Field>
              <FieldLabel htmlFor="email" className="text-gray-700">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="m@example.com"
                required
                className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
              />
              <FieldDescription className="text-gray-500">
                We&apos;ll use this to contact you. We won&apos;t share it.
              </FieldDescription>
            </Field>

            {/* Password */}
            <Field>
              <FieldLabel htmlFor="password" className="text-gray-700">Password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                required
                className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
              />
              <FieldDescription className="text-gray-500">
                At least 8 characters.
              </FieldDescription>
            </Field>

            {/* Confirm */}
            <Field>
              <FieldLabel htmlFor="confirm-password" className="text-gray-700">Confirm password</FieldLabel>
              <Input
                id="confirm-password"
                name="confirm-password"
                type="password"
                required
                className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
              />
              <FieldDescription className="text-gray-500">
                Please confirm your password.
              </FieldDescription>
            </Field>
          </FieldGroup>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white"
            >
              {loading ? "Creating account..." : "Create account"}
            </Button>

            <Button
              variant="outline"
              type="button"
              className="w-full border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              onClick={onGoogleSignup}
            >
              Sign up with Google
            </Button>

            <p className="text-sm text-gray-600 text-center">
              Already have an account?{" "}
              <a
                href="/login"
                className="text-blue-600 underline underline-offset-4 hover:text-blue-500"
              >
                Sign in
              </a>
            </p>
          </div>

          {/* Hidden input if you ever submit role via email/password signup */}
          <input type="hidden" name="role" value={role} />
        </form>
      </CardContent>
    </Card>
  )
}