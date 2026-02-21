import { SignupForm } from "@/components/signup-form"

export default function Page() {
  return (
    <div className="min-h-svh w-full flex items-center justify-center p-6 md:p-10 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      <div className="w-full max-w-sm">
        <SignupForm />
      </div>
    </div>
  )
}