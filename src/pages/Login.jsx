import { useNavigate } from "react-router-dom";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { intern } from "../constants/app";

export default function Login() {
  const navigate = useNavigate();
  const login = (e) => { e.preventDefault(); navigate("/"); };
  return (
    <div className="login-page">
      <div className="login-glow"/>
      <div className="login-card">
        <div className="brand login-brand"><div className="brand-mark">AD</div><div><strong>AD TECH</strong><span>Intern Manager</span></div></div>
        <div className="eyebrow">Secure workspace</div>
        <h1>Welcome back</h1>
        <p>Sign in to access your internship workspace.</p>
        <form onSubmit={login}>
          <label>Work email<input type="email" placeholder="you@adtechenterprises.com" required/></label>
          <label>Password<input type="password" placeholder="••••••••" required/></label>
          <button className="btn btn-primary btn-wide"><LockKeyhole size={17}/> Sign in</button>
        </form>
        <div className="login-note"><ShieldCheck size={16}/><span>Authentication is ready for backend integration.</span></div>
        <button className="demo-link" onClick={() => navigate("/")}>Open UI demo as {intern.name}</button>
      </div>
    </div>
  );
}