import { LoginForm } from "@/components/login-form"

export default function Page() {
  return (
    <div className="min-h-svh w-full flex items-center justify-center p-6 md:p-10 bg-gradient-to-br from-blue-50 via-white to-blue-100">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}