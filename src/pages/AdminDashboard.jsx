import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Clock3, ListTodo, ShieldAlert, Users, Coffee, AlertTriangle } from "lucide-react";
import Card from "../components/Card";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { useAuth } from "../authContext";
import { formatDuration } from "../hooks/useSession";

const MOCK_BACKEND_URL = import.meta.env.VITE_MOCK_BACKEND_URL || "http://127.0.0.1:4000/api/v1";
const SESSION_BADGE_TONE = { ACTIVE: "success", BREAK: "warning", LOCKED: "warning", INCOMPLETE: "danger" };

export default function AdminDashboard() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [interns, setInterns] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const res = await fetch(`${MOCK_BACKEND_URL}/admin/interns`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Could not load overview");
      setInterns(json.data);
    } catch (e) {
      setError(e.message || "Could not reach the server.");
    }
  }

  useEffect(() => { load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = {
    total: interns?.length ?? 0,
    active: interns?.filter((i) => i.session?.status === "ACTIVE").length ?? 0,
    onBreak: interns?.filter((i) => i.session?.status === "BREAK").length ?? 0,
    // LOCKED: a failed/expired check paused this session right now - needs a look.
    locked: interns?.filter((i) => i.session?.status === "LOCKED").length ?? 0,
    // INCOMPLETE: too many failed checks ended the session; it will not count toward attendance.
    incomplete: interns?.filter((i) => i.session?.status === "INCOMPLETE").length ?? 0,
    completed: interns?.filter((i) => i.session?.status === "COMPLETED").length ?? 0,
  };

  return (
    <>
      <PageHeader eyebrow="Administration" title="Admin Dashboard" description="Team-wide overview of internship work sessions, tasks and presence."/>

      {error && (
        <EmptyState icon={AlertTriangle} title="Could not load the overview" description={error}
          action={<button className="btn btn-secondary" onClick={load}>Try again</button>}/>
      )}

      {!error && (
        <div className="stats-grid">
          <StatCard icon={Users} label="Total interns" value={interns ? stats.total : "…"} detail="Current internship team"/>
          <StatCard icon={Activity} label="Active now" value={interns ? stats.active : "…"} detail="Official work sessions"/>
          <StatCard icon={Coffee} label="On break" value={interns ? stats.onBreak : "…"} detail="Current status"/>
          <StatCard icon={ShieldAlert} label="Verification paused" value={interns ? stats.locked : "…"} detail="Failed a check, retrying now"/>
          <StatCard icon={AlertTriangle} label="Incomplete today" value={interns ? stats.incomplete : "…"} detail="Too many failed checks"/>
          <StatCard icon={Clock3} label="Completed today" value={interns ? stats.completed : "…"} detail="Sessions"/>
          <StatCard icon={ListTodo} label="Pending tasks" value="—" detail="Pending Adarsh's real backend"/>
        </div>
      )}

      {!error && (
        <Card>
          <div className="card-header"><div><div className="eyebrow">Team</div><h2>Intern status</h2></div></div>
          {interns === null && <p className="muted">Loading…</p>}
          {interns !== null && interns.length === 0 && <EmptyState title="No interns yet" description="Interns will appear here once they are added."/>}
          {interns !== null && interns.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Intern</th><th>Designation</th><th>Status</th><th>Work Time</th><th>Presence</th></tr></thead>
                <tbody>
                  {interns.map((i) => (
                    <tr key={i.id} onClick={() => navigate(`/admin/interns/${i.id}`)} style={{ cursor: "pointer" }}>
                      <td><strong>{i.name}</strong></td>
                      <td>{i.designation}</td>
                      <td><StatusBadge tone={SESSION_BADGE_TONE[i.session?.status] ?? "default"}>{i.session?.status ?? "Not started"}</StatusBadge></td>
                      <td>{i.session ? formatDuration(i.session.activeSeconds ?? 0) : "—"}</td>
                      <td><StatusBadge tone={i.verification.status === "VERIFIED" ? "success" : i.verification.status === "UNVERIFIED" ? "danger" : "default"}>{i.verification.status}</StatusBadge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
