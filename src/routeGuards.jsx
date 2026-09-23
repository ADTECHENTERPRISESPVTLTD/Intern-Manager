import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./authContext";

/** Sends anyone not logged in to /login, remembering where they were headed. */
export function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

/** Blocks interns from admin routes. Requires RequireAuth to already have run. */
export function RequireAdmin({ children }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}
