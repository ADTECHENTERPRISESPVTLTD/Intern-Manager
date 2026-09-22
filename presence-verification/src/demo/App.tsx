/**
 * DEMO SHELL ONLY. Akanksha's real dashboard replaces this file.
 * It exists so the verification popup can be seen working against the mock backend.
 * The token is kept in memory on purpose (it is lost on reload; nothing sensitive goes to localStorage).
 */
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createVerificationService, FaceRegistration, PresenceVerification, type VerificationStatus } from "../presence-verification";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4000/api/v1";

interface User {
  name: string;
  designation: string;
}
interface Session {
  status: "ACTIVE" | "BREAK" | "COMPLETED";
  activeSeconds: number;
  targetSeconds: number;
  completedIntervals: number;
  totalIntervals: number;
  officialAttendance: boolean;
}

async function api<T>(method: string, path: string, token?: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message ?? "Request failed");
  return json.data as T;
}

const clock = (s: number) => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");

export function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      const data = await api<{ token: string; user: User }>("POST", "/auth/login", undefined, {
        email: form.get("email"),
        password: form.get("password"),
      });
      setToken(data.token);
      setUser(data.user);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  if (!token || !user) {
    return (
      <main className="demo">
        <form className="demo-card" onSubmit={login}>
          <h1>AD TECH Intern Portal (demo)</h1>
          <label>
            Email
            <input name="email" type="email" defaultValue="intern@demo.local" required />
          </label>
          <label>
            Password
            <input name="password" type="password" defaultValue="demo123" required />
          </label>
          {error && <p role="alert" className="demo-error">{error}</p>}
          <button className="pv-btn pv-btn--primary" type="submit">
            Log in
          </button>
        </form>
      </main>
    );
  }
  return <Dashboard token={token} user={user} onLogout={() => (setToken(null), setUser(null))} />;
}

function Dashboard({ token, user, onLogout }: { token: string; user: User; onLogout: () => void }) {
  const service = useMemo(() => createVerificationService({ baseUrl: BASE, getToken: () => token }), [token]);
  const [session, setSession] = useState<Session | null>(null);
  const [verification, setVerification] = useState<VerificationStatus | null>(null);
  const [registered, setRegistered] = useState<boolean | null>(null);
  // Keep the registration card on screen for a few seconds after success so the intern sees the confirmation.
  const [showRegistration, setShowRegistration] = useState(false);
  const [message, setMessage] = useState("");

  const loadSession = useCallback(async () => {
    try {
      setSession(await api<Session | null>("GET", "/sessions/current", token));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not load session");
    }
  }, [token]);

  useEffect(() => {
    void loadSession();
    const id = setInterval(loadSession, 2000);
    return () => clearInterval(id);
  }, [loadSession]);

  useEffect(() => {
    service.getRegistration().then((r) => setRegistered(r.registered)).catch(() => setRegistered(null));
  }, [service]);

  useEffect(() => {
    if (registered === false) setShowRegistration(true);
    if (registered === true) {
      const id = setTimeout(() => setShowRegistration(false), 4000);
      return () => clearTimeout(id);
    }
  }, [registered]);

  const act = (path: string, body?: unknown) => async () => {
    try {
      await api("POST", path, token, body);
      setMessage("");
      await loadSession();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Action failed");
    }
  };

  // Session-level state shown to the intern. The backend decides; this only chooses a label.
  const state =
    !session ? "Not started"
    : session.status === "COMPLETED" ? "8-Hour Work Session Completed"
    : session.status === "BREAK" ? "Break Active"
    : verification?.sessionVerificationStatus === "UNVERIFIED" ? "Presence Unverified"
    : "Work Session Active";
  const tone = state.startsWith("Presence") ? "orange" : state.startsWith("Break") ? "amber" : state.startsWith("Not") ? "grey" : "green";

  return (
    <main className="demo">
      <header className="demo-head">
        <div>
          <h1>Good Morning, {user.name}</h1>
          <p>{user.designation}</p>
        </div>
        <button className="pv-btn pv-btn--ghost" onClick={onLogout}>Logout</button>
      </header>

      <section className="demo-card" aria-label="Official work session">
        <p className="demo-label">OFFICIAL WORK SESSION</p>
        <p className="demo-state"><span className={`demo-dot demo-dot--${tone}`} aria-hidden="true" />{state}</p>
        {session && !session.officialAttendance && <p className="demo-note">Testing mode: this time is not official attendance yet.</p>}
        <p className="demo-clock">{clock(session?.activeSeconds ?? 0)}</p>
        <p className="demo-label">30-SECOND SESSIONS COMPLETED</p>
        <p className="demo-big">{session?.completedIntervals ?? 0} / {session?.totalIntervals ?? 960}</p>
        <div className="demo-row">
          {(!session || session.status === "COMPLETED") && <button className="pv-btn pv-btn--primary" onClick={act("/sessions/start")}>Start Official Work Session</button>}
          {session?.status === "ACTIVE" && <button className="pv-btn pv-btn--ghost" onClick={act("/sessions/break")}>Take Break</button>}
          {session?.status === "BREAK" && <button className="pv-btn pv-btn--primary" onClick={act("/sessions/resume")}>Resume Work</button>}
        </div>
        {message && <p role="alert" className="demo-error">{message}</p>}
      </section>

      {showRegistration && <FaceRegistration service={service} onRegistered={() => setRegistered(true)} />}

      <section className="demo-card demo-dev" aria-label="Demo controls">
        <p className="demo-label">DEMO CONTROLS (mock backend only)</p>
        <div className="demo-row">
          <button className="pv-btn pv-btn--ghost" onClick={act("/dev/advance", { seconds: 30 })}>Skip ahead 30 s</button>
          <button className="pv-btn pv-btn--ghost" onClick={act("/dev/advance", { seconds: 300 })}>Skip ahead 5 min</button>
          <button className="pv-btn pv-btn--ghost" onClick={act("/dev/advance", { seconds: 1800 })}>Skip ahead 30 min</button>
          <button className="pv-btn pv-btn--ghost" onClick={act("/dev/advance", { seconds: 28800 })}>Skip ahead 8 hours</button>
        </div>
      </section>

      <PresenceVerification
        service={service}
        pollIntervalMs={3000}
        onStatusChange={setVerification}
        onSessionExpired={onLogout}
        onRegistrationRequired={() => setRegistered(false)}
      />
    </main>
  );
}
