import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

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
  // { href: '/intereses',      label: 'Intereses',     icon: '🧠' },
  { href: "/configuracion", label: "Alertas", icon: "🔔" },
  { href: "/perfil", label: "Perfil", icon: "🧑‍💻" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-gray-50 text-gray-900`}>
        {/* Sidebar / Navbar */}
        <div className="flex min-h-screen">
          <aside className="w-56 bg-gray-100 border-r border-gray-200 fixed inset-y-0 left-0 flex flex-col">
            <div className="px-6 py-5 border-b border-gray-200">
              <span className="font-bold text-gray-900 text-sm">
                Job Hunter
              </span>
              <span className="block text-xs text-gray-500 mt-0.5">
                v1.0 · MVP
              </span>
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
            <div className="px-4 py-4 border-t border-gray-200">
              <p className="text-xs text-gray-400">Ramiro Toulemonde</p>
              <p className="text-xs text-gray-400">Senior Frontend Dev</p>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 ml-56 min-h-screen">{children}</main>
        </div>
      </body>
    </html>
  );
}
