"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { signInUser, signUpUser } from "@/lib/supabase";
import SignUpModal from "./SignUpModal";
import { useRouter } from "next/navigation";

export default function AuthForm() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showSignUp, setShowSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      setMessage("¡Sesión iniciada! Redirigiendo...");
      window.location.href = "/";
    } catch (error: any) {
      const errorMsg = error.message?.toLowerCase() || "";
      if (errorMsg.includes("invalid login credentials")) {
        setMessage("Email o contraseña incorrectos.");
      } else if (errorMsg.includes("confirmation")) {
        setMessage("Debes confirmar tu email antes de ingresar.");
      } else {
        setMessage("Ocurrió un error al intentar ingresar.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="max-w-md mx-auto p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 transition-all duration-500">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-2 italic tracking-tight">
            Bienvenido !
          </h2>
          <p className="text-slate-500 text-sm">
            Ingresa tus credenciales para continuar
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-5 py-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:border-indigo-500 outline-none transition-all"
              placeholder="ejemplo@correo.com"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-3 pr-12 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:border-indigo-500 outline-none transition-all"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-[0.97] disabled:opacity-50 mt-4"
          >
            {loading ? "Procesando..." : "Iniciar Sesión"}
          </button>
        </form>

        {message && (
          <div
            className={`mt-6 p-4 rounded-xl text-sm text-center font-medium ${message.includes("error") || message.includes("incorrectos") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}
          >
            {message}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-slate-500 text-sm mb-2">¿No tienes cuenta?</p>
          <button
            onClick={() => setShowSignUp(true)}
            className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
          >
            Regístrate ahora
          </button>
        </div>
      </div>

      <SignUpModal isOpen={showSignUp} onClose={() => setShowSignUp(false)} />
    </>
  );
}
