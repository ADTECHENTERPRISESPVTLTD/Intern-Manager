/**
 * TEMPORARY: connects the presence-verification popup to Soham's mock backend so it works
 * today, before Adarsh's real backend and Akanksha's real login exist.
 *
 * Replace `loginDemo()` with the real auth flow once available, and point `baseUrl` at the
 * real backend (see docs/verification-contract.md for the endpoints it must implement).
 */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createVerificationService } from "./presence-verification";

const MOCK_BACKEND_URL = import.meta.env.VITE_MOCK_BACKEND_URL || "http://127.0.0.1:4000/api/v1";
const DEMO_CREDENTIALS = { email: "intern@demo.local", password: "demo123" };

const VerificationContext = createContext(null);

export function useVerificationStatus() {
  return useContext(VerificationContext);
}

export function VerificationProvider({ children }) {
  const [token, setToken] = useState(null);
  const [status, setStatus] = useState(null); // latest status from <PresenceVerification onStatusChange>

  useEffect(() => {
    let cancelled = false;
    fetch(`${MOCK_BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(DEMO_CREDENTIALS),
    })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.success) setToken(json.data.token);
      })
      .catch(() => {
        /* mock backend not running: the popup below will just show "can't reach the server" */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const service = useMemo(() => createVerificationService({ baseUrl: MOCK_BACKEND_URL, getToken: () => token }), [token]);

  return (
    <VerificationContext.Provider value={{ service, status, setStatus, ready: Boolean(token) }}>
      {children}
    </VerificationContext.Provider>
  );
}
