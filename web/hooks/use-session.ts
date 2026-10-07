"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearSession, readSession } from "@/lib/session";
import type { Role, Session } from "@/lib/types";
export function useSession(requiredRole: Role) {
  const router = useRouter(),
    [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = readSession();
      if (!current) router.replace("/login");
      else if (current.user.role !== requiredRole)
        router.replace(current.user.role === "ADMIN" ? "/admin" : "/resident");
      else setSession(current);
    }, 0);
    return () => clearTimeout(timer);
  }, [requiredRole, router]);
  function logout() {
    clearSession();
    router.replace("/login");
  }
  return { session, logout };
}
