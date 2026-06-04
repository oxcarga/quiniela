"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getIdTokenResult } from "firebase/auth";
import { Home, CalendarDays, UserRound, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const BASE_ITEMS = [
  { href: "/",        label: "Inicio",   icon: Home },
  { href: "/matches", label: "Partidos", icon: CalendarDays },
  { href: "/profile", label: "Perfil",   icon: UserRound },
] as const;

export default function Navbar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    getIdTokenResult(user).then((r) => setIsAdmin(r.claims.admin === true));
  }, [user]);

  if (!user || pathname === "/login" || pathname === "/onboarding") return null;

  const items = isAdmin
    ? [...BASE_ITEMS, { href: "/admin" as const, label: "Admin", icon: ShieldCheck }]
    : BASE_ITEMS;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-zinc-200 bg-white dark:border-zinc-800">
      <ul className="flex h-16 items-stretch ">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex flex-1 bg-indigo-100">
              <Link
                href={href}
                className={`flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                  active
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 1.75} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
