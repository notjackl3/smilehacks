"use client"

import * as React from "react"
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
  const [role, setRole] = React.useState<"dentist" | "patient">("dentist")

  async function onGoogleSignup() {
    // ✅ persist selected role across OAuth redirect
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
        "border border-white/15 bg-white/10 backdrop-blur-md",
        "text-white",
        "border-t-4 border-t-blue-400/70",
        props.className ?? "",
      ].join(" ")}
    >
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl">Create an account</CardTitle>
        <CardDescription className="text-blue-100/80">
          Enter your information below to create your account.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="space-y-6">
          <FieldGroup>
            {/* Role */}
            <Field>
              <FieldLabel>Account type</FieldLabel>
              <RadioGroup
                value={role}
                onValueChange={(v) => setRole(v as "dentist" | "patient")}
                className="grid grid-cols-2 gap-3"
              >
                <label className="flex items-center gap-3 rounded-lg border border-white/15 bg-white/5 p-3 cursor-pointer hover:bg-white/10 transition">
                  <RadioGroupItem value="dentist" />
                  <div className="leading-tight">
                    <div className="text-sm font-medium">Dentist</div>
                    <div className="text-xs text-blue-100/70">
                      For clinics & providers
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 rounded-lg border border-white/15 bg-white/5 p-3 cursor-pointer hover:bg-white/10 transition">
                  <RadioGroupItem value="patient" />
                  <div className="leading-tight">
                    <div className="text-sm font-medium">Patient</div>
                    <div className="text-xs text-blue-100/70">
                      For personal use
                    </div>
                  </div>
                </label>
              </RadioGroup>
              <FieldDescription className="text-blue-100/70">
                You can change this later in settings.
              </FieldDescription>
            </Field>

            {/* Name */}
            <Field>
              <FieldLabel htmlFor="name">Full name</FieldLabel>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                required
                className="bg-white/5 border-white/15 text-white placeholder:text-blue-100/50 focus-visible:ring-blue-400/60"
              />
            </Field>

            {/* Email */}
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                className="bg-white/5 border-white/15 text-white placeholder:text-blue-100/50 focus-visible:ring-blue-400/60"
              />
              <FieldDescription className="text-blue-100/70">
                We&apos;ll use this to contact you. We won&apos;t share it.
              </FieldDescription>
            </Field>

            {/* Password */}
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                required
                className="bg-white/5 border-white/15 text-white placeholder:text-blue-100/50 focus-visible:ring-blue-400/60"
              />
              <FieldDescription className="text-blue-100/70">
                At least 8 characters.
              </FieldDescription>
            </Field>

            {/* Confirm */}
            <Field>
              <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
              <Input
                id="confirm-password"
                type="password"
                required
                className="bg-white/5 border-white/15 text-white placeholder:text-blue-100/50 focus-visible:ring-blue-400/60"
              />
              <FieldDescription className="text-blue-100/70">
                Please confirm your password.
              </FieldDescription>
            </Field>
          </FieldGroup>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              type="submit"
              className="w-full bg-blue-500 hover:bg-blue-600 text-white"
            >
              Create account
            </Button>

            <Button
              variant="outline"
              type="button"
              className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10"
              onClick={onGoogleSignup}
            >
              Sign up with Google
            </Button>

            <p className="text-sm text-blue-100/70 text-center">
              Already have an account?{" "}
              <a
                href="/login"
                className="text-blue-200 underline underline-offset-4 hover:text-blue-100"
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