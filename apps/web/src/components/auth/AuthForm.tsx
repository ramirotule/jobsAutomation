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
            ¡Hola!
          </h2>
          <p className="text-slate-500 text-sm">
            Ingresa tus credenciales para continuar
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Email</label>
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
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:border-indigo-500 outline-none transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.97] disabled:opacity-50 mt-4"
          >
            {loading ? "Procesando..." : "Iniciar Sesión"}
          </button>
        </form>

        {message && (
          <div className={`mt-6 p-4 rounded-xl text-sm text-center font-medium ${message.includes('error') || message.includes('incorrectos') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
            {message}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-slate-500 text-sm mb-2">
            ¿No tienes cuenta?
          </p>
          <button
            onClick={() => setShowSignUp(true)}
            className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
          >
            Regístrate ahora
          </button>
        </div>
      </div>

      <SignUpModal 
        isOpen={showSignUp} 
        onClose={() => setShowSignUp(false)} 
      />
    </>
  );
}
