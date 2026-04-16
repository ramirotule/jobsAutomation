"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLink {
  href: string;
  label: string;
  icon: string;
}

const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/vacantes", label: "Vacantes", icon: "🎯" },
  { href: "/postulaciones", label: "Postulaciones", icon: "🚀" },
  { href: "/configuracion", label: "Alertas", icon: "🔔" },
  { href: "/perfil", label: "Perfil", icon: "🧑‍💻" },
];

export function SidebarLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {NAV_LINKS.map((link) => {
        const isActive = link.href === "/" 
          ? pathname === "/" 
          : pathname.startsWith(link.href);
          
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ease-out ${
              isActive
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-[1.02]"
                : "text-gray-500 hover:bg-white hover:text-indigo-600 hover:shadow-sm"
            }`}
          >
            <span className={`text-xl transition-transform duration-300 ${isActive ? "scale-110" : "group-hover:scale-110"}`}>
              {link.icon}
            </span>
            <span className="tracking-tight">{link.label}</span>
            {isActive && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
