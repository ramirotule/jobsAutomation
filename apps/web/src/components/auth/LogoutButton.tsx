"use client";

import { createClient } from "@/utils/supabase/client";

export default function LogoutButton() {
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
      title="Cerrar Sesión"
    >
      <span className="text-lg">🚪</span>
      <span>Cerrar Sesión</span>
    </button>
  );
}
