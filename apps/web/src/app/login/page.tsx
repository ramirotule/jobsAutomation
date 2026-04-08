import AuthForm from '@/components/auth/AuthForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Job Hunter
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
            Automatiza tu búsqueda de empleo
          </p>
        </div>
        
        <AuthForm />
        
        <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-8">
          &copy; {new Date().getFullYear()} Ramiro Toulemonde · MVP
        </p>
      </div>
    </div>
  )
}
