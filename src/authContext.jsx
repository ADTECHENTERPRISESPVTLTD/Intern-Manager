/**
 * Real login/logout/role state.
 *
 * TEMPORARY: points at Soham's mock backend so login actually works today. Swap
 * MOCK_BACKEND_URL for the real backend once Adarsh's auth exists — the shape
 * (success/data/message, {token, user}) already matches docs/verification-contract.md,
 * so nothing else here should need to change.
 *
 * The token is kept in sessionStorage (cleared when the tab closes), not localStorage,
 * so it doesn't linger on a shared machine.
 */
import { createContext, useContext, useEffect, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";
const STORAGE_KEY = "intern-manager.auth";

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function readStored() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStored); // { token, user } | null
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private browsing etc.: session still works for this tab, just won't survive a refresh */
    }
  }, [session]);

  async function login(email, password) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.message || "Could not sign in. Check your details and try again.");
        return null;
      }
      setSession({ token: json.data.token, user: json.data.user });
      return json.data.user;
    } catch {
      setError("Could not reach the server. Is it running?");
      return null;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setSession(null);
  }

  const value = {
    token: session?.token ?? null,
    user: session?.user ?? null,
    isAuthenticated: Boolean(session?.token),
    isAdmin: session?.user?.role === "ADMIN",
    login,
    logout,
    loading,
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
