"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { readSession, saveSession } from "@/lib/session";
import type { Session } from "@/lib/types";

const demoAccounts = {
  resident: "demo@demo.com",
  admin: "admin@admin.com",
} as const;

export default function LoginPage() {
  const router = useRouter();
  const [busyRole, setBusyRole] = useState<keyof typeof demoAccounts | null>(
    null,
  );
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const session = readSession();
      if (session) {
        router.replace(session.user.role === "ADMIN" ? "/admin" : "/resident");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router]);

  async function signIn(role: keyof typeof demoAccounts) {
    setBusyRole(role);
    setError("");
    try {
      const session = await api<Session>("/auth/login", undefined, {
        method: "POST",
        body: JSON.stringify({ email: demoAccounts[role] }),
      });
      saveSession(session);
      router.replace(session.user.role === "ADMIN" ? "/admin" : "/resident");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in failed");
      setBusyRole(null);
    }
  }

  return (
    <main className="login">
      <section className="login-card">
        <b className="brand">Move Desk</b>
        <h1>Choose your role</h1>
        <p>Select how you want to explore the prototype.</p>
        <div className="role-options">
          <section className="role-card">
            <div>
              <h2>Resident</h2>
              <p>Create and track a move-in or move-out request.</p>
            </div>
            <button
              className="btn primary"
              disabled={busyRole !== null}
              onClick={() => signIn("resident")}
            >
              {busyRole === "resident" ? "Opening…" : "Continue as Resident"}
            </button>
          </section>
          <section className="role-card">
            <div>
              <h2>Admin</h2>
              <p>Review resident requests and record a decision.</p>
            </div>
            <button
              className="btn"
              disabled={busyRole !== null}
              onClick={() => signIn("admin")}
            >
              {busyRole === "admin" ? "Opening…" : "Continue as Admin"}
            </button>
          </section>
        </div>
        {error && (
          <span className="error" role="alert">
            {error}
          </span>
        )}
      </section>
    </main>
  );
}
