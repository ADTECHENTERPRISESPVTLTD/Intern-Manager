import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyhole, ShieldCheck, AlertCircle } from "lucide-react";
import { useAuth } from "../authContext";

export default function Login() {
  const navigate = useNavigate();
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(e) {
    e.preventDefault();
    const user = await login(email, password);
    if (user) navigate(user.role === "ADMIN" ? "/admin" : "/", { replace: true });
  }

  return (
    <div className="login-page">
      <div className="login-glow"/>
      <div className="login-card">
        <div className="brand login-brand"><div className="brand-mark">AD</div><div><strong>AD TECH</strong><span>Intern Manager</span></div></div>
        <div className="eyebrow">Secure workspace</div>
        <h1>Welcome back</h1>
        <p>Sign in to access your internship workspace.</p>
        <form onSubmit={submit}>
          <label>Work email
            <input type="email" placeholder="you@adtechenterprises.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username"/>
          </label>
          <label>Password
            <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password"/>
          </label>
          {error && <div className="login-error" role="alert"><AlertCircle size={15}/> {error}</div>}
          <button className="btn btn-primary btn-wide" disabled={loading}>
            <LockKeyhole size={17}/> {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="login-note"><ShieldCheck size={16}/><span>Checked against the test backend (temporary, until the real one is connected).</span></div>
      </div>
    </div>
  );
}
