import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import LogoutButton from "@/components/auth/LogoutButton";
import { UtilityToolbar } from "@/components/UtilityToolbar";
import { SidebarLinks } from "@/components/SidebarLinks";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileMenuDrawer } from "@/components/MobileMenuDrawer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Job Hunter — Ramiro Toulemonde",
  description:
    "Automatizador de búsqueda de empleo para perfiles React / React Native",
};


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
      <html lang="es" suppressHydrationWarning>
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `try{const t=localStorage.getItem('theme');const p=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(t===null&&p))document.documentElement.classList.add('dark')}catch(e){}`,
            }}
          />
        </head>
        <body className={`${inter.className} bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100`}>
          <ThemeProvider>
            <main className="min-h-screen">{children}</main>
          </ThemeProvider>
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
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const t=localStorage.getItem('theme');const p=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(t===null&&p))document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body
        className={`${inter.className} bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <div className="flex min-h-screen">
            <UtilityToolbar />

            {/* ── Mobile top header ──────────────────────────────── */}
            <header className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4">
              <MobileMenuDrawer firstName={firstName} lastName={lastName} />
              <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">Job Hunter</span>
              <div className="w-9" />{/* spacer to keep title centered */}
            </header>

            {/* ── Desktop sidebar ───────────────────────────────── */}
            <aside className="hidden lg:flex w-56 bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 fixed inset-y-0 left-0 flex-col">
              <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">Job Hunter</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">v1.0 · MVP</span>
              </div>

              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-800/40">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Bienvenido/a</p>
                <p className="font-bold text-sm text-indigo-600 dark:text-indigo-400 truncate">{firstName} {lastName}</p>
              </div>

              <SidebarLinks />

              <div className="px-3 py-4 border-t border-gray-200 dark:border-gray-800 space-y-4">
                <LogoutButton />
                <div className="px-3">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter">Desarrollado por</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Ramiro Toulemonde</p>
                </div>
              </div>
            </aside>

            {/* ── Theme toggle — fixed top-right ────────────────── */}
            <div className="fixed top-3.5 right-4 z-50 lg:top-4 lg:right-5">
              <ThemeToggle />
            </div>

            {/* ── Main content ──────────────────────────────────── */}
            {/* pt-14 = mobile top header height */}
            <main className="flex-1 ml-0 lg:ml-56 min-h-screen pt-14 lg:pt-0">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
