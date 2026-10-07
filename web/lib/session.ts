import type { Session } from "./types";
const KEY = "move-desk-session";
export function saveSession(session: Session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}
export function readSession(): Session | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    localStorage.removeItem(KEY);
    return null;
  }
}
export function clearSession() {
  localStorage.removeItem(KEY);
}
