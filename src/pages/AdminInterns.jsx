import { useEffect, useState } from "react";
import { Search, RefreshCw, AlertTriangle } from "lucide-react";
import Card from "../components/Card";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import { useAuth } from "../authContext";

const MOCK_BACKEND_URL = import.meta.env.VITE_MOCK_BACKEND_URL || "http://127.0.0.1:4000/api/v1";

// Real backend value -> what the status badge shows. See docs/verification-contract.md.
const VERIFICATION_LABEL = {
  VERIFIED: ["Verified", "success"],
  FAILED: ["Failed", "danger"],
  UNVERIFIED: ["Unverified", "warning"],
  PENDING: ["Pending", "warning"],
  NONE: ["Not started", "default"],
};

export default function AdminInterns() {
  const { token } = useAuth();
  const [interns, setInterns] = useState(null); // null = loading
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  async function load() {
    setError("");
    setInterns(null);
    try {
      const res = await fetch(`${MOCK_BACKEND_URL}/admin/interns`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Could not load interns");
      setInterns(json.data);
    } catch (e) {
      setError(e.message || "Could not reach the server.");
      setInterns([]);
    }
  }

  useEffect(() => { load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = (interns ?? []).filter((i) => i.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <PageHeader eyebrow="Administration" title="Interns" description="Open an intern profile to review tasks, sessions, attendance and feedback."/>
      <Card>
        <div className="toolbar">
          <div className="search"><Search size={17}/><input placeholder="Search interns..." value={query} onChange={(e) => setQuery(e.target.value)}/></div>
          <button className="btn btn-ghost" onClick={load}><RefreshCw size={15}/> Refresh</button>
        </div>

        {interns === null && (
          <div className="table-wrap" aria-busy="true">
            <table><tbody>
              {[0, 1, 2].map((i) => (
                <tr key={i} className="skeleton-row"><td colSpan={5}><div className="skeleton-bar"/></td></tr>
              ))}
            </tbody></table>
          </div>
        )}

        {interns !== null && error && (
          <EmptyState icon={AlertTriangle} title="Could not load interns" description={error}
            action={<button className="btn btn-secondary" onClick={load}>Try again</button>}/>
        )}

        {interns !== null && !error && filtered.length === 0 && (
          <EmptyState title={query ? "No matching interns" : "No interns yet"}
            description={query ? "Try a different search." : "Interns will appear here once they are added."}/>
        )}

        {interns !== null && !error && filtered.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Intern</th><th>Designation</th><th>Session</th><th>Presence</th><th>Action</th></tr></thead>
              <tbody>
                {filtered.map((i) => {
                  const [label, tone] = VERIFICATION_LABEL[i.verification.status] ?? VERIFICATION_LABEL.NONE;
                  return (
                    <tr key={i.id}>
                      <td><strong>{i.name}</strong></td>
                      <td>{i.designation}</td>
                      <td><StatusBadge tone={i.session?.status === "ACTIVE" ? "success" : "default"}>{i.session?.status ?? "Not started"}</StatusBadge></td>
                      <td>
                        <StatusBadge tone={tone}>{label}</StatusBadge>
                        {i.verification.failedCount > 0 && <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{i.verification.failedCount} failed</span>}
                      </td>
                      <td><button className="btn btn-ghost">View profile</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
