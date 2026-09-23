/**
 * Real official-work-session state: start, break, resume — against Soham's mock backend.
 *
 * TEMPORARY: point `baseUrl` at the real backend once Adarsh's exists (same response shape
 * per docs/verification-contract.md / the backend task doc's session endpoints).
 *
 * The backend is the only authority on the numbers here — this just polls and displays them.
 * Never invent activeSeconds/completedIntervals on the frontend (see the backend task doc,
 * "Session Security": the server must calculate these, not the browser).
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./authContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

const SessionContext = createContext(null);

export function useWorkSession() {
  return useContext(SessionContext);
}

export function SessionProvider({ children }) {
  const { token, isAuthenticated, isAdmin } = useAuth();
  const [session, setSession] = useState(null); // null = no session yet (or not loaded)
  const [error, setError] = useState("");

  const active = isAuthenticated && !isAdmin && Boolean(token); // admins don't have work sessions

  const call = useCallback(
    async (method, path) => {
      const res = await fetch(`${API_BASE_URL}${path}`, { method, headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.message || "Request failed");
      return json.data;
    },
    [token],
  );

  const refresh = useCallback(async () => {
    if (!active) return;
    try {
      setSession(await call("GET", "/sessions/current"));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [active, call]);

  useEffect(() => {
    if (!active) {
      setSession(null);
      return;
    }
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [active, refresh]);

  async function start() {
    try {
      setSession(await call("POST", "/sessions/start"));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  async function takeBreak() {
    try {
      setSession(await call("POST", "/sessions/break"));
    } catch (e) {
      setError(e.message);
    }
  }
  async function resume() {
    try {
      setSession(await call("POST", "/sessions/resume"));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <SessionContext.Provider value={{ session, error, start, takeBreak, resume, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}
