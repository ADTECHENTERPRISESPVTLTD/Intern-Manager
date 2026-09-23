/**
 * Connects the presence-verification popup to Soham's mock backend, using whoever is
 * actually logged in (via authContext) — not a hidden separate login of its own.
 *
 * TEMPORARY: point `baseUrl` at the real backend once Adarsh's exists (see
 * docs/verification-contract.md for the endpoints it must implement); nothing else here
 * should need to change, since the shapes already match.
 */
import { createContext, useContext, useMemo, useState } from "react";
import { createVerificationService } from "./presence-verification";
import { useAuth } from "./authContext";

const MOCK_BACKEND_URL = import.meta.env.VITE_MOCK_BACKEND_URL || "http://127.0.0.1:4000/api/v1";

const VerificationContext = createContext(null);

export function useVerificationStatus() {
  return useContext(VerificationContext);
}

export function VerificationProvider({ children }) {
  const { token, isAuthenticated, isAdmin } = useAuth();
  const [status, setStatus] = useState(null); // latest status from <PresenceVerification onStatusChange>

  const service = useMemo(() => createVerificationService({ baseUrl: MOCK_BACKEND_URL, getToken: () => token }), [token]);

  // Only an intern with an active session ever needs a presence check; admins never do.
  const ready = isAuthenticated && !isAdmin && Boolean(token);

  return (
    <VerificationContext.Provider value={{ service, status, setStatus, ready }}>
      {children}
    </VerificationContext.Provider>
  );
}
