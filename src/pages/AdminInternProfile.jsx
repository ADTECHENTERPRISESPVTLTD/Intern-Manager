import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle, ShieldCheck, Clock3, Activity } from "lucide-react";
import Card from "../components/Card";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import { useAuth } from "../authContext";
import { formatDuration } from "../hooks/useSession";

const MOCK_BACKEND_URL = import.meta.env.VITE_MOCK_BACKEND_URL || "http://127.0.0.1:4000/api/v1";

const VERIFICATION_LABEL = {
  VERIFIED: ["Verified", "success"],
  FAILED: ["Failed", "danger"],
  UNVERIFIED: ["Unverified", "warning"],
  PENDING: ["Pending", "warning"],
  INCOMPLETE: ["Incomplete", "danger"],
  NONE: ["Not started", "default"],
};

const SESSION_BADGE_TONE = { ACTIVE: "success", BREAK: "warning", LOCKED: "warning", INCOMPLETE: "danger" };

async function get(path, token) {
  const res = await fetch(`${MOCK_BACKEND_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Request failed");
  return json.data;
}

export default function AdminInternProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [intern, setIntern] = useState(null); // undefined-ish states handled via null + error
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      // No single-intern detail endpoint exists on the (temporary) mock backend, so this
      // reuses the same list /admin/interns already proven to work on the Interns page.
      const [interns, historyPage] = await Promise.all([
        get("/admin/interns", token),
        get(`/verifications/history?internId=${id}`, token),
      ]);
      const found = interns.find((i) => i.id === id);
      if (!found) throw new Error("Intern not found");
      setIntern(found);
      setHistory(historyPage.items);
    } catch (e) {
      setError(e.message || "Could not load this profile.");
    }
  }

  useEffect(() => { load(); }, [id, token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <button className="back-link" onClick={() => navigate("/admin/interns")}><ArrowLeft size={15}/> Back to Interns</button>

      {!intern && !error && <p className="muted">Loading…</p>}

      {error && (
        <EmptyState icon={AlertTriangle} title="Could not load this profile" description={error}
          action={<button className="btn btn-secondary" onClick={load}>Try again</button>}/>
      )}

      {intern && (
        <>
          <div className="page-header">
            <div>
              <div className="eyebrow">Administration · Intern profile</div>
              <h1>{intern.name}</h1>
              <p>{intern.designation}</p>
            </div>
            <StatusBadge tone={SESSION_BADGE_TONE[intern.session?.status] ?? "default"}>
              {intern.session?.status ?? "Not started"}
            </StatusBadge>
          </div>

          <div className="detail-grid">
            <div className="stack">
              <Card>
                <div className="card-title"><Clock3/> Official work session</div>
                {intern.session ? (
                  <div className="meta-list">
                    <div><Activity/><span>Active time<strong>{formatDuration(intern.session.activeSeconds ?? 0)}</strong></span></div>
                    <div><Clock3/><span>30-second sessions<strong>{intern.session.completedIntervals ?? 0} / {intern.session.totalIntervals ?? 960}</strong></span></div>
                  </div>
                ) : (
                  <p className="muted">No session started yet.</p>
                )}
              </Card>

              <Card>
                <div className="card-title"><ShieldCheck/> Presence verification</div>
                {(() => {
                  const [label, tone] = VERIFICATION_LABEL[intern.verification.status] ?? VERIFICATION_LABEL.NONE;
                  return (
                    <div className="meta-list">
                      <div><ShieldCheck/><span>Current status<strong><StatusBadge tone={tone}>{label}</StatusBadge></strong></span></div>
                      <div><Clock3/><span>Last verified<strong>{intern.verification.lastVerifiedAt ? new Date(intern.verification.lastVerifiedAt).toLocaleString() : "Never"}</strong></span></div>
                      <div><AlertTriangle/><span>Failed attempts<strong>{intern.verification.failedCount}</strong></span></div>
                      <div><AlertTriangle/><span>Unverified checks<strong>{intern.verification.unverifiedCount}</strong></span></div>
                    </div>
                  );
                })()}
              </Card>
            </div>

            <div className="stack">
              <Card>
                <div className="card-title"><Clock3/> Verification history</div>
                {history && history.length === 0 && <p className="muted">No verification checks yet.</p>}
                {history && history.length > 0 && (
                  <div className="history">
                    {history.map((h) => (
                      <div key={h.verificationId}>
                        <span>{new Date(h.requestedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        <b>{h.status}{h.reason ? ` — ${h.reason}` : ""}</b>
                        <span>{h.attempts} attempt{h.attempts === 1 ? "" : "s"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <div className="card-title">Tasks &amp; performance</div>
                <p className="muted">Not available yet — pending Adarsh's real backend. This page will not invent numbers for these.</p>
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}
