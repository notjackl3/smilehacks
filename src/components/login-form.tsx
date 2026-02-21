"use client"

import * as React from "react"
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

export function LoginForm(props: React.ComponentProps<typeof Card>) {
  const [loading, setLoading] = React.useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    // We'll connect to Supabase next.
    // const form = new FormData(e.currentTarget)
    // const email = String(form.get("email") || "")
    // const password = String(form.get("password") || "")

    setTimeout(() => setLoading(false), 400)
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
        <CardTitle className="text-2xl text-white">Welcome back</CardTitle>
        <CardDescription className="text-blue-100/80">
          Sign in to continue.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-blue-100/90">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="m@example.com"
                required
                className="bg-white/5 border-white/15 text-white placeholder:text-blue-100/50 focus-visible:ring-blue-400/60"
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-blue-100/90">
                  Password
                </Label>
                <a
                  href="#"
                  className="text-xs text-blue-200 hover:text-blue-100 underline underline-offset-4"
                >
                  Forgot password?
                </a>
              </div>

              <Input
                id="password"
                name="password"
                type="password"
                required
                className="bg-white/5 border-white/15 text-white placeholder:text-blue-100/50 focus-visible:ring-blue-400/60"
              />
            </div>
          </div>

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
              className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10"
            >
              Continue with Google
            </Button>

            <p className="text-sm text-blue-100/70 text-center">
              Don&apos;t have an account?{" "}
              <a
                href="/signup"
                className="text-blue-200 underline underline-offset-4 hover:text-blue-100"
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