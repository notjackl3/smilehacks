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

export function LoginForm(props: React.ComponentProps<typeof Card>) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const username = formData.get("username") as string
    const password = formData.get("password") as string

    try {
      // Find user by username and password
      const { data: user, error: loginError } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .eq("password", password) // Note: In production, compare hashed passwords!
        .single()

      if (loginError || !user) {
        setError("Invalid username or password")
        setLoading(false)
        return
      }

      // Store user info in localStorage for session
      localStorage.setItem("current_user", JSON.stringify({
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.full_name
      }))

      router.push("/")
    } catch (err: any) {
      setError("Login failed. Please try again.")
      setLoading(false)
    }
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
            <div className="grid gap-2">
              <Label htmlFor="username" className="text-gray-700">
                Username
              </Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="johndoe"
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