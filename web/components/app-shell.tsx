"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Session } from "@/lib/types";
export function AppShell({
  session,
  onLogout,
  children,
}: {
  session: Session;
  onLogout: () => void;
  children: ReactNode;
}) {
  const admin = session.user.role === "ADMIN";
  return (
    <div className="shell">
      <aside className="side">
        <b className="brand">Move Desk</b>
        <small>{admin ? "ADMINISTRATION" : session.user.community}</small>
        <nav>
          <Link className="active" href={admin ? "/admin" : "/resident"}>
            {admin ? "Requests" : "Move request"}
          </Link>
        </nav>
        <div className="profile">
          <b>{admin ? "Admin" : "Resident"}</b>
          <span>{admin ? "Admin" : `Unit ${session.user.unit}`}</span>
        </div>
      </aside>
      <section className="work">
        <header>
          <span>Requests</span>
          <button onClick={onLogout}>Sign out</button>
        </header>
        {children}
      </section>
    </div>
  );
}
