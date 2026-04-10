import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import LogoutButton from "@/components/auth/LogoutButton";
import { UtilityToolbar } from "@/components/UtilityToolbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Job Hunter — Ramiro Toulemonde",
  description:
    "Automatizador de búsqueda de empleo para perfiles React / React Native",
};

const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/vacantes", label: "Vacantes", icon: "🎯" },
  { href: "/postulaciones", label: "Postulaciones", icon: "🚀" },
  { href: "/configuracion", label: "Alertas", icon: "🔔" },
  { href: "/perfil", label: "Perfil", icon: "🧑‍💻" },
];

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Si no hay usuario, renderizamos solo el children (que será la página de login)
  if (!user) {
    return (
      <html lang="es">
        <body className={`${inter.className} bg-gray-50 text-gray-900`}>
          <main className="min-h-screen">{children}</main>
        </body>
      </html>
    );
  }

  const firstName = user.user_metadata?.first_name || "Usuario";
  const lastName = user.user_metadata?.last_name || "";

  // Fetch social links for current user
  const { data: profile } = await supabase
    .from("profiles")
    .select("linkedin_url, github_url, portfolio_url")
    .eq("id", user.id)
    .maybeSingle();

  // El perfil se carga directamente en UtilityToolbar

  return (
    <html lang="es">
      <body 
        className={`${inter.className} bg-gray-50 text-gray-900`}
        suppressHydrationWarning
      >
        <div className="flex min-h-screen">
          <UtilityToolbar />
          
          <aside className="w-56 bg-gray-100 border-r border-gray-200 fixed inset-y-0 left-0 flex flex-col">
            <div className="px-6 py-5 border-b border-gray-200">
              <span className="font-bold text-gray-900 text-sm">
                Job Hunter
              </span>
              <span className="block text-xs text-gray-500 mt-0.5">
                v1.0 · MVP
              </span>
            </div>
            
            {/* Bienvenida */}
            <div className="px-6 py-4 border-b border-gray-200 bg-white/50">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bienvenido/a</p>
              <p className="font-bold text-sm text-indigo-600 truncate">{firstName} {lastName}</p>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors"
                >
                  <span className="text-lg">{link.icon}</span>
                  {link.label}
                </Link>
              ))}
            </nav>
            
            <div className="px-3 py-4 border-t border-gray-200 space-y-4">
              <LogoutButton />
              
              <div className="px-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Desarrollado por</p>
                <p className="text-xs text-gray-500 font-medium">Ramiro Toulemonde</p>
              </div>
            </div>
          </aside>

          <main className="flex-1 ml-56 min-h-screen">{children}</main>
        </div>
      </body>
    </html>
  );
}
